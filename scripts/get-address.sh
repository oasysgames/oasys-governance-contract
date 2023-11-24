#!/bin/bash

# Check if CALLDATA environment variable is supplied
if [ -z "$CALLDATA" ]; then
    echo "Error: CALLDATA environment variable is not supplied."
    exit 1
fi

# Remove "0x" prefix if present in CALLDATA
CALLDATA="${CALLDATA#0x}"

# Calculate the length of CALLDATA in hex, padding to 64 characters
SIZE=$(printf '%064x' $((${#CALLDATA} / 2)))

# Construct and execute the curl command
curl https://rpc.mainnet.oasys.games \
  -X POST \
  -H "Content-Type: application/json" \
  --data '{"method":"eth_call","params":[{"from": null,"to":"0x123e3ae459a8D049F27Ba62B8a5D48c68A100EBC","data":"0x44f6fec700000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000'"$SIZE$CALLDATA"'"}, "latest"],"id":1,"jsonrpc":"2.0"}'
