#!/bin/bash
cd "$(dirname "$0")"
export PATH="$PWD/pinbin:$PATH"
./xjudge_all.sh c11 c12 c13 c14 c15 c16 c17 c18 c19 c20
python3 -u driver.py c11 c12 c13 c14 c15 c16 c18 c19 c20
echo "CHAIN END"
