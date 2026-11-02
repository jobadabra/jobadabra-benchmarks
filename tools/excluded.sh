#!/bin/bash
# Every company we ever tested or fixed on, for pick-forms.mjs (27 Oct 2026: the draw's list was made by hand once and lost; a weekly draw on CI
# rebuilds it): every web address (host + first path part) in the product repo's tracked files and in this repo's form lists and saved runs.
# Broad on purpose: a company named anywhere in our code is never drawn. pick-forms.mjs matches a company's slug inside this text.
# Usage: tools/excluded.sh <product checkout> <this repo> [more dirs, e.g. the weekly-picks tag] > excluded.txt   (sorted, one per line).
# Guard: test/excluded.test.mjs.
jp=${1:?product checkout}; here=${2:?this repo}; shift 2
{ git -C "$jp" grep -hoIE 'https?://[A-Za-z0-9.-]+(/[A-Za-z0-9_.-]+)?' 2>/dev/null
  grep -rhoIE 'https?://[A-Za-z0-9.-]+(/[A-Za-z0-9_.-]+)?' "$here"/forms*.json "$here"/results "$@" 2>/dev/null
} | sed -E 's#^https?://##' | tr 'A-Z' 'a-z' | sort -u
