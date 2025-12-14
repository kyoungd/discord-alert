#!/bin/bash

# Create or clear the output file - force overwrite if exists
> make_one.txt

# Function to add file contents with header
add_file_content() {
    echo "=== File: $1 ===" >> make_one.txt
    echo "" >> make_one.txt
    cat "$1" >> make_one.txt
    echo "" >> make_one.txt
    echo "=== End of $1 ===" >> make_one.txt
    echo "" >> make_one.txt
}

# Find and process .js, .html, and .json files in current directory and subdirectories
find . -type f \( -name "*.md" -o -name "*.js" -o -name "*.html" -o -name "*.json" \) -not -path "./make_one.txt" | while read file; do
    add_file_content "$file"
done
