#!/usr/bin/env bash
set -euo pipefail

verify_and_join() {
  local output="$1"
  local dir="$2"
  shift 2
  local expected=("$@")
  for i in $(seq 0 $((${#expected[@]} - 1))); do
    local part="${dir}/$(printf '%s' "${3:-part}")${i}"
    local actual
    actual="$(sha256sum "$part" | cut -d' ' -f1)"
    if [[ "$actual" != "${expected[$i]}" ]]; then
      echo "PART_MISMATCH ${part} expected=${expected[$i]} actual=${actual}"
      exit 1
    fi
  done
}

sub_expected=(
  60afe3d7e2488a808a2ee4624ede55c6102d13a53008305be06775226c44bcf8
  149b78423fbea463da687bb2119fbc6d8874a97ca3598066238b04a115c18341
  807451fddb9576cb2b6d017f80b42dbcfedc8e4d96397829e5e0ed154597c5d7
  d051be0cfb0200ad43870ff91e9313621eee686917b8ddd21f469d0741ffd201
)
for i in $(seq 0 3); do
  part=".source-v2/chunk09-parts/part3-subs/sub${i}"
  actual="$(sha256sum "$part" | cut -d' ' -f1)"
  if [[ "$actual" != "${sub_expected[$i]}" ]]; then
    echo "SUBPART_MISMATCH sub${i} expected=${sub_expected[$i]} actual=${actual}"
    exit 1
  fi
done
cat .source-v2/chunk09-parts/part3-subs/sub{0..3} > .source-v2/chunk09-parts/part3

echo "CHUNK09_PART3_REBUILT"

rebuild_chunk() {
  local chunk="$1"
  shift
  local expected=("$@")
  local dir=".source-v2/${chunk}-parts"
  for i in $(seq 0 $((${#expected[@]} - 1))); do
    local part="${dir}/part${i}"
    local actual
    actual="$(sha256sum "$part" | cut -d' ' -f1)"
    if [[ "$actual" != "${expected[$i]}" ]]; then
      echo "PART_MISMATCH ${chunk}/part${i} expected=${expected[$i]} actual=${actual}"
      exit 1
    fi
  done
  cat "${dir}"/part{0..3} > ".source-v2/${chunk}"
  echo "${chunk^^}_REBUILT"
}

rebuild_chunk chunk03 \
  2c4392b437a12c4f6f281221c1b62ebd36887769854c0e9620fc2acb4941d670 \
  07c7435bf50fd262875989dd0b50a2f31f10bd44605d29d2765b954a8b39f791 \
  082e0fb32dc7ce32fdb097c6e28fa37cbba591b14a1df7e62b35b68f3e9db885 \
  5c6fb593a2118fbd4c56f1bcf559c009ec01de6e9f2edb2603c3c721c6b2e5da

rebuild_chunk chunk09 \
  d5856ce30d21ac210b4d1238f07f8dc21c0094907f4d1161fb78287f19cfecb0 \
  e7f4d217d6334123ce826df22eff9cfb534adef11fc7a64c2ab91c88fd0b5965 \
  a72c59fc4eafad5a49c0bb02b839a01f5dae73d3d466e075c18d64623705fe7d \
  e79beb011a80f0085d9ba48cfc116a422e49bd6905296fcb97404806c612a13d

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
