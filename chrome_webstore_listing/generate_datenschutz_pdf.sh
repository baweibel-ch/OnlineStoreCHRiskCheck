#!/bin/bash

# Wechsel in das Verzeichnis des Skripts
cd "$(dirname "$0")" || exit

# Generiere PDF aus Markdown
pandoc Datenschutz.md -V mainfont="Arial" -o Datenschutz.pdf
