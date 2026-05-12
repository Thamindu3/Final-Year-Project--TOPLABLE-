import os

import cv2
import numpy as np
from PIL import Image, ImageFilter
import torch


def gen_noise(shape):
    noise = np.zeros(shape, dtype=np.uint8)
    noise = cv2.randn(noise, 0, 255)
    noise = np.asarray(noise / 255, dtype=np.uint8)
    noise = torch.tensor(noise, dtype=torch.float32)
    return noise


def apply_sharpen(img: Image.Image, strength: float) -> Image.Image:
    """Unsharp masking post-process. strength: 0=off, 1.0=medium, 2.0=strong."""
    if strength <= 0:
        return img
    # radius=2, percent scales with strength (150% at 1.0, 300% at 2.0), threshold=3
    percent = int(150 * strength)
    return img.filter(ImageFilter.UnsharpMask(radius=2, percent=percent, threshold=3))


def save_images(img_tensors, img_names, save_dir, sharpen: float = 0.0):
    for img_tensor, img_name in zip(img_tensors, img_names):
        tensor = (img_tensor.clone() + 1) * 0.5 * 255
        tensor = tensor.cpu().clamp(0, 255)

        try:
            array = tensor.numpy().astype('uint8')
        except Exception:
            array = tensor.detach().numpy().astype('uint8')

        if array.shape[0] == 1:
            array = array.squeeze(0)
        elif array.shape[0] == 3:
            array = array.swapaxes(0, 1).swapaxes(1, 2)

        im = Image.fromarray(array)
        im = apply_sharpen(im, sharpen)
        im.save(os.path.join(save_dir, img_name), format='JPEG')


def load_checkpoint(model, checkpoint_path):
    if not os.path.exists(checkpoint_path):
        raise ValueError("'{}' is not a valid checkpoint path".format(checkpoint_path))
    model.load_state_dict(torch.load(checkpoint_path, map_location="cpu", weights_only=False))
