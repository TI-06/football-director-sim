#!/usr/bin/env bash
set -euo pipefail

expected=(
  060c51acb7498ce59d3fecb2c7c21b7fa23449a1ac6955eb567a2b84d1e5a306
  f28448971f299fddec333f47623dfaaf35f828395ffa2d484ef55f5614e7f617
  acd9551ec4877ab4c7603f312347a6e8ea036dbc83e30d6648202145d53224c3
  889be10e3b3bc0d8e067e6067ed4542ed1d05d8355d3f6f30d7f494b78e180cc
  3bbcc09df8aaeca72fb8f16d9218334df4cb69184a58514266aa1b316f50c495
  c967849a2e3df50785781ae767318fcf1e3cc24187bff8628b13a3a5fa78f7cb
  a08032a9710a6ed2e0153f094f9f02722faa7522b6b8c9148456dc79feb5fe7a
  30b83bff189e25b0e35618ee7bbf2e8a6e371374bcaf8076f00fc1b35d173700
  2b2dcde30f8aab6005356be8105b76d731269824c0c47224f06450391e3c291f
  1d9900d2c14b8c5fd48fb4e9c9aa5871daf8ba7a5b61c0370990a100b7bcec65
  ccde2839b0ad8e8270f2af89bbf7bcff95cbb16ffb419539dbaab6f8d6e017f8
  3b6af1328231c62a8d1dc5a132d0bf8ff376f50a2e024e883344cbecd7b3977a
  575353a1194a15a2a2ef249ca46a0879f27f3b6221cf315845c677fc26733ffa
  bb0bc0c1513d686776ecf55dcb18e6ada482209ffef7f55fe53b43e914d5940e
)

for i in $(seq -w 0 13); do
  file=".source-v2/chunk${i}"
  actual="$(sha256sum "$file" | cut -d' ' -f1)"
  index=$((10#$i))
  if [[ "$actual" != "${expected[$index]}" ]]; then
    echo "CHUNK_MISMATCH chunk${i} expected=${expected[$index]} actual=${actual}"
    exit 1
  fi
done

echo "ALL_CHUNKS_OK"
cat .source-v2/chunk{00..13} > /tmp/football-director-source.b64
bytes="$(wc -c < /tmp/football-director-source.b64)"
[[ "$bytes" == "109240" ]] || { echo "BASE64_SIZE_MISMATCH expected=109240 actual=$bytes"; exit 1; }
base64 --decode /tmp/football-director-source.b64 > /tmp/football-director-source.zip
actual_zip="$(sha256sum /tmp/football-director-source.zip | cut -d' ' -f1)"
expected_zip="c1af393010663b43f138a4ab683ea4c0c819b0dffa58968b92a481f86bb1190c"
[[ "$actual_zip" == "$expected_zip" ]] || { echo "ZIP_MISMATCH expected=$expected_zip actual=$actual_zip"; exit 1; }
unzip -t /tmp/football-director-source.zip >/dev/null

echo "ARCHIVE_OK sha256=$actual_zip"
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
unzip -q /tmp/football-director-source.zip -d .
