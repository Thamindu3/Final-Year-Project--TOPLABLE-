#!/usr/bin/env bash
set -euo pipefail

# Simple setup script for VITON-HD (bash/WSL/Git-Bash/macOS/Linux)
# Usage: ./setup_viton.sh [venv_name] [python_cmd]
# Example: ./setup_viton.sh viton-env python3.8

ENV_NAME="${1:-viton-env}"
PYTHON_CMD="${2:-python3.8}"

echo "Using python: $PYTHON_CMD"
echo "Creating virtualenv: $ENV_NAME"
$PYTHON_CMD -m venv "$ENV_NAME"

echo
echo "Activate the venv with:"
echo "  source $ENV_NAME/bin/activate    # bash / WSL / Git-Bash / macOS"
echo "  $ENV_NAME\\Scripts\\Activate.ps1  # PowerShell on Windows"
echo
echo "Now activating the venv to install base packages..."
source "$ENV_NAME/bin/activate"

echo "Upgrading pip, setuptools, wheel"
pip install --upgrade pip setuptools wheel

echo
echo "Install PyTorch and other Python packages."
echo "Choose the correct PyTorch install command from https://pytorch.org depending on your CUDA/CPU setup."
echo "Example (CUDA 11.8):"
echo "  pip install torch torchvision --extra-index-url https://download.pytorch.org/whl/cu118"
echo "Or for CPU-only builds:" 
echo "  pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu"

echo
echo "Installing common dependencies: opencv-python, torchgeometry, gdown"
pip install opencv-python torchgeometry gdown || true

echo
echo "Helper notes for downloading pretrained checkpoints and dataset:" 
echo " - The README expects pretrained files in ./checkpoints/ and dataset in ./datasets/."
echo " - You can use gdown to download from Google Drive. Replace <GDRIVE_ID> with the file id."

cat <<'EOF'
Example download commands (edit IDs):

# Download checkpoints.zip -> unzip to ./checkpoints/
gdown https://drive.google.com/uc?id=<CHECKPOINTS_GDRIVE_ID> -O checkpoints/models.zip
unzip checkpoints/models.zip -d checkpoints/

# Download dataset.zip -> unzip to ./datasets/
gdown https://drive.google.com/uc?id=<DATASET_GDRIVE_ID> -O datasets/viton_hd.zip
unzip datasets/viton_hd.zip -d datasets/

# Run test (after setting CUDA_VISIBLE_DEVICES if needed):
export CUDA_VISIBLE_DEVICES=0
python test.py --name job_example
EOF

echo
echo "setup_viton.sh complete. Edit the script to add Drive IDs and the exact PyTorch install line for your system."
