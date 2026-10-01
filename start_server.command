#!/bin/bash
cd "$(dirname "$0")"
echo "5F1 Amp Lab Simulator: http://localhost:8090"
python3 -m http.server 8090
