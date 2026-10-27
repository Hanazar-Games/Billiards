#!/bin/bash
# Runs the benchmark inside the real Nakama JS runtime (goja) and writes
# results/goja.json. Requires a running Docker daemon and `node build.mjs`.
# RUNS/WARMUP default low: one goja shot takes seconds, not milliseconds.
set -euo pipefail
cd "$(dirname "$0")"

RUNS=${RUNS:-3}
WARMUP=${WARMUP:-1}
NAKAMA_TAG=$(sed -n 's#.*heroiclabs/nakama:\(.*\)#\1#p' nakama/docker-compose.yml)

(cd nakama && docker compose up -d)
for _ in $(seq 1 60); do
  curl -sf http://127.0.0.1:7350/healthcheck > /dev/null && break
  sleep 2
done

payload="{\"runs\":$RUNS,\"warmup\":$WARMUP,\"seed\":7,\"models\":[\"fixed\"],\"runtime\":\"nakama $NAKAMA_TAG\"}"
mkdir -p results
curl -sf -m 3600 "http://127.0.0.1:7350/v2/rpc/sim_bench?http_key=defaulthttpkey&unwrap" -d "$payload" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);r.cpu=require("os").cpus()[0].model+" x"+require("os").cpus().length;console.log(JSON.stringify(r,null,2))})' \
  > results/goja.json
echo "wrote results/goja.json"
