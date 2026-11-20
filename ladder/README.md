# The first two steps of the build (scripts you can read in one sitting)

Steps 1 and 2 of the step-by-step build are single scripts. Steps 3 to 8 are the application itself (see `docs/STEP-BY-STEP-BUILD.md`).

| File | What it is | Lines to read |
|---|---|---|
| `step1_one_agent.py` | One LangChain agent, a form to fill, no tools. Reads a paper and returns invoice fields. | about 65 |
| `step2_three_small_fixes.py` | Step 1 plus three small fixes: say what kind of paper it is, fingerprint each file so it is never read twice, save each result as soon as it exists. | about 75 |

## Run them (needs Docker, the image from `make up` or `make setup && make up`, a key in `.env`, and the demo papers)

Load the fixed demo papers first (see `demo-data/README.md`): `make demo-fixed`.

```bash
# Step 1 on one paper
docker compose run --rm --no-deps -v "$PWD/ladder:/app/ladder" -v "$PWD/data:/app/data" api python ladder/step1_one_agent.py data/generated/files/0002_bundle_scan.pdf

# Step 2, twice: the second run skips both papers because their fingerprints are already saved
rm -f ladder/results.jsonl
docker compose run --rm --no-deps -v "$PWD/ladder:/app/ladder" -v "$PWD/data:/app/data" api python ladder/step2_three_small_fixes.py data/generated/files/0002_coa_1.pdf data/generated/files/0010_einvoice.json
docker compose run --rm --no-deps -v "$PWD/ladder:/app/ladder" -v "$PWD/data:/app/data" api python ladder/step2_three_small_fixes.py data/generated/files/0002_coa_1.pdf data/generated/files/0010_einvoice.json
```

Model answers on non-invoices can differ a little between runs. `ladder/results.jsonl` is created by step 2 and is not committed.
