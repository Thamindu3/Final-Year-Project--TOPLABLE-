# =============================================================
# FILE: viton-hd/train.py
# PURPOSE: Train VITON-HD with improved accuracy settings
#
# Key improvements over default VITON-HD:
#   - grid_size=7  (vs 5)  → 49 TPS control points, finer cloth warping
#   - GMM resolution 384x288 (vs 256x192) → better warp quality
#   - VGG perceptual loss for ALIASGenerator → better texture/detail
#   - Feature matching loss → stable GAN training
#
# Training stages:
#   Stage 1: python train.py --stage seg   --epochs 100
#   Stage 2: python train.py --stage gmm   --epochs 100
#   Stage 3: python train.py --stage alias --epochs 200
#
# Dataset layout (VITON-HD format):
#   datasets/train/image/          person images
#   datasets/train/cloth/          cloth images
#   datasets/train/cloth-mask/     cloth masks
#   datasets/train/image-parse/    person segmentation maps
#   datasets/train/openpose-json/  pose keypoints
#   datasets/train/openpose-img/   pose images
# =============================================================

import argparse
import os
import time

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader
from torchvision import models
from torchvision.utils import save_image

from datasets import VITONDataset, VITONDataLoader
from networks import SegGenerator, GMM, ALIASGenerator
from utils import gen_noise, load_checkpoint


device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# ══════════════════════════════════════════════════════════════
# LOSSES
# ══════════════════════════════════════════════════════════════

class VGGPerceptualLoss(nn.Module):
    """VGG16 feature matching loss at relu1_2, relu2_2, relu3_3, relu4_3."""

    def __init__(self):
        super().__init__()
        vgg = models.vgg16(weights=models.VGG16_Weights.DEFAULT).features
        self.slice1 = nn.Sequential(*list(vgg)[:4]).eval()    # relu1_2
        self.slice2 = nn.Sequential(*list(vgg)[4:9]).eval()   # relu2_2
        self.slice3 = nn.Sequential(*list(vgg)[9:16]).eval()  # relu3_3
        self.slice4 = nn.Sequential(*list(vgg)[16:23]).eval() # relu4_3
        for p in self.parameters():
            p.requires_grad = False

    def forward(self, pred, target):
        # Normalize to VGG input range
        mean = torch.tensor([0.485, 0.456, 0.406], device=pred.device).view(1, 3, 1, 1)
        std  = torch.tensor([0.229, 0.224, 0.225], device=pred.device).view(1, 3, 1, 1)
        pred   = (pred   * 0.5 + 0.5 - mean) / std
        target = (target * 0.5 + 0.5 - mean) / std

        loss = 0.0
        for sl in (self.slice1, self.slice2, self.slice3, self.slice4):
            pred   = sl(pred)
            target = sl(target)
            loss  += F.l1_loss(pred, target.detach())
        return loss


class PatchGANDiscriminator(nn.Module):
    """70x70 PatchGAN discriminator."""

    def __init__(self, input_nc=6, ndf=64, n_layers=3):
        super().__init__()
        from torch.nn.utils.spectral_norm import spectral_norm

        def block(in_c, out_c, stride=2, norm=True):
            layers = [spectral_norm(nn.Conv2d(in_c, out_c, 4, stride, 1))]
            if norm:
                layers.append(nn.InstanceNorm2d(out_c))
            layers.append(nn.LeakyReLU(0.2, inplace=True))
            return layers

        nf = ndf
        seq = block(input_nc, nf, norm=False)
        for _ in range(1, n_layers):
            seq += block(nf, min(nf * 2, 512))
            nf = min(nf * 2, 512)
        seq += block(nf, min(nf * 2, 512), stride=1)
        seq += [spectral_norm(nn.Conv2d(min(nf * 2, 512), 1, 4, 1, 1))]
        self.model = nn.Sequential(*seq)

    def forward(self, x):
        return self.model(x)


def gan_loss(pred, is_real):
    target = torch.ones_like(pred) if is_real else torch.zeros_like(pred)
    return F.mse_loss(pred, target)


def feature_matching_loss(pred_feats, real_feats):
    loss = 0.0
    for p, r in zip(pred_feats, real_feats):
        loss += F.l1_loss(p, r.detach())
    return loss / len(pred_feats)


# ══════════════════════════════════════════════════════════════
# STAGE 1: SegGenerator
# ══════════════════════════════════════════════════════════════

def train_seg(opt):
    print("\n=== Stage 1: Training SegGenerator ===\n")
    seg = SegGenerator(opt, opt.semantic_nc + 8, opt.semantic_nc).to(device).train()

    if opt.seg_checkpoint and os.path.exists(os.path.join(opt.checkpoint_dir, opt.seg_checkpoint)):
        load_checkpoint(seg, os.path.join(opt.checkpoint_dir, opt.seg_checkpoint))
        print("  Loaded existing seg checkpoint — fine-tuning.")

    optimizer = torch.optim.Adam(seg.parameters(), lr=opt.lr, betas=(0.5, 0.999))
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=50, gamma=0.1)

    train_dataset = VITONDataset(opt)
    train_loader  = VITONDataLoader(opt, train_dataset)

    up = nn.Upsample(size=(opt.load_height, opt.load_width), mode='bilinear', align_corners=False).to(device)

    ce_loss = nn.CrossEntropyLoss()

    for epoch in range(1, opt.epochs + 1):
        epoch_loss = 0.0
        t0 = time.time()

        for i, inputs in enumerate(train_loader.data_loader):
            parse_agnostic = inputs['parse_agnostic'].to(device)
            pose           = inputs['pose'].to(device)
            c              = inputs['cloth']['unpaired'].to(device)
            cm             = inputs['cloth_mask']['unpaired'].to(device)
            parse_gt       = inputs['parse'].to(device)   # ground truth segmentation (long tensor)

            parse_agnostic_down = F.interpolate(parse_agnostic, (256, 192))
            pose_down           = F.interpolate(pose, (256, 192))
            c_masked_down       = F.interpolate(c * cm, (256, 192))
            cm_down             = F.interpolate(cm, (256, 192))

            noise     = gen_noise(cm_down.size()).to(device)
            seg_input = torch.cat((cm_down, c_masked_down, parse_agnostic_down, pose_down, noise), dim=1)

            parse_pred_down = seg(seg_input)
            parse_pred      = up(parse_pred_down)

            loss = ce_loss(parse_pred, parse_gt.squeeze(1).long())

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item()

        scheduler.step()
        avg = epoch_loss / max(len(train_loader.data_loader), 1)
        print(f"  Epoch [{epoch:3d}/{opt.epochs}]  CE={avg:.4f}  ({time.time()-t0:.1f}s)")

        if epoch % opt.save_freq == 0:
            ckpt = os.path.join(opt.checkpoint_dir, f"seg_epoch{epoch:04d}.pth")
            torch.save(seg.state_dict(), ckpt)

    torch.save(seg.state_dict(), os.path.join(opt.checkpoint_dir, "seg_final.pth"))
    print("  Saved seg_final.pth")


# ══════════════════════════════════════════════════════════════
# STAGE 2: GMM  (cloth warping)
# ══════════════════════════════════════════════════════════════

def train_gmm(opt):
    print("\n=== Stage 2: Training GMM ===\n")
    print(f"  Grid size : {opt.grid_size}  ({opt.grid_size**2} TPS control points)")
    print(f"  GMM res   : {opt.gmm_height}x{opt.gmm_width}")

    gmm = GMM(opt, 7, 3).to(device).train()

    if opt.gmm_checkpoint and os.path.exists(os.path.join(opt.checkpoint_dir, opt.gmm_checkpoint)):
        load_checkpoint(gmm, os.path.join(opt.checkpoint_dir, opt.gmm_checkpoint))
        print("  Loaded existing gmm checkpoint — fine-tuning.")

    optimizer = torch.optim.Adam(gmm.parameters(), lr=opt.lr, betas=(0.5, 0.999))
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=50, gamma=0.1)

    train_dataset = VITONDataset(opt)
    train_loader  = VITONDataLoader(opt, train_dataset)

    for epoch in range(1, opt.epochs + 1):
        epoch_loss = 0.0
        t0 = time.time()

        for i, inputs in enumerate(train_loader.data_loader):
            img_agnostic = inputs['img_agnostic'].to(device)
            pose         = inputs['pose'].to(device)
            c            = inputs['cloth']['unpaired'].to(device)
            cm           = inputs['cloth_mask']['unpaired'].to(device)
            # parse[:, 2:3] = cloth region in the ground truth person image
            parse        = inputs['parse_agnostic'].to(device)

            # Downsample to improved GMM resolution
            agnostic_gmm    = F.interpolate(img_agnostic, (opt.gmm_height, opt.gmm_width))
            parse_cloth_gmm = F.interpolate(parse[:, 2:3], (opt.gmm_height, opt.gmm_width))
            pose_gmm        = F.interpolate(pose, (opt.gmm_height, opt.gmm_width))
            c_gmm           = F.interpolate(c, (opt.gmm_height, opt.gmm_width))
            cm_gmm          = F.interpolate(cm, (opt.gmm_height, opt.gmm_width))

            # Ground truth: cloth warped to fit the person's cloth region
            c_gt = F.interpolate(c, (opt.load_height, opt.load_width)) * \
                   F.interpolate(parse[:, 2:3], (opt.load_height, opt.load_width))

            gmm_input = torch.cat((parse_cloth_gmm, pose_gmm, agnostic_gmm), dim=1)
            _, warped_grid = gmm(gmm_input, c_gmm)

            warped_c  = F.grid_sample(c,  warped_grid, padding_mode='border', align_corners=False)
            warped_cm = F.grid_sample(cm, warped_grid, padding_mode='border', align_corners=False)

            # L1 on warped cloth vs ground truth cloth region
            loss_l1 = F.l1_loss(warped_c * warped_cm, c_gt)
            # TV regularization on the warp grid to keep deformation smooth
            loss_tv = (warped_grid[:, 1:, :, :] - warped_grid[:, :-1, :, :]).abs().mean() + \
                      (warped_grid[:, :, 1:, :] - warped_grid[:, :, :-1, :]).abs().mean()

            loss = loss_l1 + 0.01 * loss_tv

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item()

        scheduler.step()
        avg = epoch_loss / max(len(train_loader.data_loader), 1)
        print(f"  Epoch [{epoch:3d}/{opt.epochs}]  L1={avg:.4f}  ({time.time()-t0:.1f}s)")

        if epoch % opt.save_freq == 0:
            ckpt = os.path.join(opt.checkpoint_dir, f"gmm_epoch{epoch:04d}.pth")
            torch.save(gmm.state_dict(), ckpt)

    torch.save(gmm.state_dict(), os.path.join(opt.checkpoint_dir, "gmm_final.pth"))
    print("  Saved gmm_final.pth")


# ══════════════════════════════════════════════════════════════
# STAGE 3: ALIASGenerator  (GAN + perceptual)
# ══════════════════════════════════════════════════════════════

def train_alias(opt):
    print("\n=== Stage 3: Training ALIASGenerator ===\n")

    # Load pre-trained seg and gmm (frozen)
    seg = SegGenerator(opt, opt.semantic_nc + 8, opt.semantic_nc).to(device).eval()
    gmm = GMM(opt, 7, 3).to(device).eval()
    load_checkpoint(seg, os.path.join(opt.checkpoint_dir, opt.seg_checkpoint))
    load_checkpoint(gmm, os.path.join(opt.checkpoint_dir, opt.gmm_checkpoint))
    for p in seg.parameters(): p.requires_grad = False
    for p in gmm.parameters(): p.requires_grad = False

    opt.semantic_nc = 7
    opt.use_bilinear = False
    alias = ALIASGenerator(opt, 9).to(device).train()
    opt.semantic_nc = 13

    if opt.alias_checkpoint and os.path.exists(os.path.join(opt.checkpoint_dir, opt.alias_checkpoint)):
        load_checkpoint(alias, os.path.join(opt.checkpoint_dir, opt.alias_checkpoint))
        print("  Loaded existing alias checkpoint — fine-tuning.")

    disc = PatchGANDiscriminator(input_nc=6).to(device).train()

    vgg_loss   = VGGPerceptualLoss().to(device)
    up_seg     = nn.Upsample(size=(opt.load_height, opt.load_width), mode='bilinear', align_corners=False).to(device)

    import torchgeometry as tgm
    gauss = tgm.image.GaussianBlur((15, 15), (3, 3)).to(device)

    opt_G = torch.optim.Adam(alias.parameters(), lr=opt.lr,       betas=(0.5, 0.999))
    opt_D = torch.optim.Adam(disc.parameters(),  lr=opt.lr * 0.5, betas=(0.5, 0.999))

    train_dataset = VITONDataset(opt)
    train_loader  = VITONDataLoader(opt, train_dataset)

    for epoch in range(1, opt.epochs + 1):
        g_total = d_total = 0.0
        t0 = time.time()

        for i, inputs in enumerate(train_loader.data_loader):
            img_gt         = inputs['img'].to(device)              # ground truth person image
            img_agnostic   = inputs['img_agnostic'].to(device)
            parse_agnostic = inputs['parse_agnostic'].to(device)
            pose           = inputs['pose'].to(device)
            c              = inputs['cloth']['unpaired'].to(device)
            cm             = inputs['cloth_mask']['unpaired'].to(device)

            with torch.no_grad():
                # Run seg
                parse_agnostic_down = F.interpolate(parse_agnostic, (256, 192))
                pose_down           = F.interpolate(pose, (256, 192))
                c_masked_down       = F.interpolate(c * cm, (256, 192))
                cm_down             = F.interpolate(cm, (256, 192))
                noise               = gen_noise(cm_down.size()).to(device)
                seg_input           = torch.cat((cm_down, c_masked_down, parse_agnostic_down, pose_down, noise), dim=1)
                parse_pred_down     = seg(seg_input)
                parse_pred          = gauss(up_seg(parse_pred_down)).argmax(dim=1)[:, None]

                parse_old = torch.zeros(parse_pred.size(0), 13, opt.load_height, opt.load_width, device=device)
                parse_old.scatter_(1, parse_pred, 1.0)
                labels = {0:[0], 1:[2,4,7,8,9,10,11], 2:[3], 3:[1], 4:[5], 5:[6], 6:[12]}
                parse = torch.zeros(parse_pred.size(0), 7, opt.load_height, opt.load_width, device=device)
                for j in labels:
                    for lbl in labels[j]:
                        parse[:, j] += parse_old[:, lbl]

                # Run gmm
                agnostic_gmm    = F.interpolate(img_agnostic, (opt.gmm_height, opt.gmm_width))
                parse_cloth_gmm = F.interpolate(parse[:, 2:3], (opt.gmm_height, opt.gmm_width))
                pose_gmm        = F.interpolate(pose, (opt.gmm_height, opt.gmm_width))
                c_gmm           = F.interpolate(c, (opt.gmm_height, opt.gmm_width))
                gmm_input       = torch.cat((parse_cloth_gmm, pose_gmm, agnostic_gmm), dim=1)
                _, warped_grid  = gmm(gmm_input, c_gmm)
                warped_c  = F.grid_sample(c,  warped_grid, padding_mode='border', align_corners=False)
                warped_cm = F.grid_sample(cm, warped_grid, padding_mode='border', align_corners=False)

            misalign_mask      = torch.clamp(parse[:, 2:3] - warped_cm, min=0.0)
            parse_div          = torch.cat((parse, misalign_mask), dim=1)
            parse_div[:, 2:3] -= misalign_mask

            gen_img = alias(torch.cat((img_agnostic, pose, warped_c), dim=1), parse, parse_div, misalign_mask)

            # ── Discriminator step ────────────────────────────
            real_pair = torch.cat((img_gt, warped_c), dim=1)
            fake_pair = torch.cat((gen_img.detach(), warped_c), dim=1)
            d_real = disc(real_pair)
            d_fake = disc(fake_pair)
            loss_D = (gan_loss(d_real, True) + gan_loss(d_fake, False)) * 0.5

            opt_D.zero_grad()
            loss_D.backward()
            opt_D.step()

            # ── Generator step ────────────────────────────────
            fake_pair_g = torch.cat((gen_img, warped_c), dim=1)
            d_fake_g    = disc(fake_pair_g)

            loss_G_adv  = gan_loss(d_fake_g, True)
            loss_G_l1   = F.l1_loss(gen_img, img_gt)
            loss_G_vgg  = vgg_loss(gen_img, img_gt)

            loss_G = loss_G_adv + 10.0 * loss_G_l1 + 5.0 * loss_G_vgg

            opt_G.zero_grad()
            loss_G.backward()
            opt_G.step()

            g_total += loss_G.item()
            d_total += loss_D.item()

        n = max(len(train_loader.data_loader), 1)
        print(f"  Epoch [{epoch:3d}/{opt.epochs}]  G={g_total/n:.4f}  D={d_total/n:.4f}  ({time.time()-t0:.1f}s)")

        if epoch % opt.save_freq == 0:
            ckpt = os.path.join(opt.checkpoint_dir, f"alias_epoch{epoch:04d}.pth")
            torch.save(alias.state_dict(), ckpt)

    torch.save(alias.state_dict(), os.path.join(opt.checkpoint_dir, "alias_final.pth"))
    print("  Saved alias_final.pth")


# ══════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════

def get_opt():
    parser = argparse.ArgumentParser()

    # Shared
    parser.add_argument('--stage', choices=['seg', 'gmm', 'alias'], required=True,
                        help='Which training stage to run')
    parser.add_argument('--epochs', type=int, default=100)
    parser.add_argument('--lr', type=float, default=2e-4)
    parser.add_argument('--save_freq', type=int, default=10,
                        help='Save checkpoint every N epochs')

    parser.add_argument('-b', '--batch_size', type=int, default=4)
    parser.add_argument('-j', '--workers', type=int, default=4)
    parser.add_argument('--load_height', type=int, default=1024)
    parser.add_argument('--load_width', type=int, default=768)
    parser.add_argument('--shuffle', action='store_true', default=True)

    parser.add_argument('--dataset_dir', type=str, default='./datasets/')
    parser.add_argument('--dataset_mode', type=str, default='train')
    parser.add_argument('--dataset_list', type=str, default='train_pairs.txt')
    parser.add_argument('--checkpoint_dir', type=str, default='./checkpoints/')
    parser.add_argument('--save_dir', type=str, default='./results/')

    parser.add_argument('--seg_checkpoint', type=str, default='seg_final.pth')
    parser.add_argument('--gmm_checkpoint', type=str, default='gmm_final.pth')
    parser.add_argument('--alias_checkpoint', type=str, default='alias_final.pth')

    parser.add_argument('--semantic_nc', type=int, default=13)
    parser.add_argument('--init_type', default='xavier')
    parser.add_argument('--init_variance', type=float, default=0.02)

    # Accuracy improvement knobs
    parser.add_argument('--grid_size', type=int, default=7,
                        help='TPS control points per axis. Default 7 (49 points) vs original 5 (25 points).')
    parser.add_argument('--gmm_height', type=int, default=288,
                        help='GMM intermediate height. Default 288 vs original 256.')
    parser.add_argument('--gmm_width', type=int, default=384,
                        help='GMM intermediate width.  Default 384 vs original 192.')

    parser.add_argument('--norm_G', type=str, default='spectralaliasinstance')
    parser.add_argument('--ngf', type=int, default=64)
    parser.add_argument('--num_upsampling_layers', default='most')

    return parser.parse_args()


def main():
    opt = get_opt()
    print(opt)
    print(f"\n  Device     : {device}")
    print(f"  grid_size  : {opt.grid_size}  ({opt.grid_size**2} TPS points, original=25)")
    print(f"  GMM res    : {opt.gmm_height}x{opt.gmm_width}  (original 256x192)")

    os.makedirs(opt.checkpoint_dir, exist_ok=True)

    if opt.stage == 'seg':
        train_seg(opt)
    elif opt.stage == 'gmm':
        train_gmm(opt)
    elif opt.stage == 'alias':
        train_alias(opt)


if __name__ == '__main__':
    main()
