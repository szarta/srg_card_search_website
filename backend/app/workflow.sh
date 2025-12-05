#!/bin/bash
set -e  # Exit on error

# Create log file with timestamp
LOG_FILE="workflow_$(date +%Y%m%d_%H%M%S).log"

# Function to log and display
exec > >(tee -a "$LOG_FILE") 2>&1

echo '================================================'
echo 'SRG Card Database Workflow'
echo '================================================'
echo "📝 Logging to: $LOG_FILE"
echo ''

# Step 1: Git pull
echo '📥 Pulling latest changes from git...'
git pull
echo ''

# Step 2: Validate cards.yaml FIRST
echo '🔍 Step 1: Validating cards.yaml...'
python3 validate_cards.py cards.yaml
if [ $? -ne 0 ]; then
    echo ''
    echo '❌ Validation failed! Please fix the errors above before continuing.'
    echo '   The database will NOT be updated.'
    exit 1
fi
echo ''

# Step 3: Backup shared lists
echo '💾 Step 2: Backing up shared lists...'
python3 backup_shared_lists.py backup || echo '⚠️  Warning: Could not backup shared lists (may not exist yet)'
echo ''

# Step 4: Recreate main database
echo '🗄️  Step 3: Creating main database...'
python3 create_db.py || echo '⚠️  Warning: Could not create main database'
echo ''

# Step 5: Restore shared lists
echo '📦 Step 4: Restoring shared lists...'
python3 backup_shared_lists.py restore || echo '⚠️  Warning: Could not restore shared lists'
echo ''

# Step 6: Load cards into main database
echo '📋 Step 5: Loading cards into main database...'
python3 load_cards_from_yaml.py || echo '⚠️  Warning: Could not load cards to main database'
echo ''

# Step 7: Generate mobile database
echo '📱 Step 6: Generating mobile database...'
python3 create_mobile_db.py srg_cards_mobile.db cards.yaml
if [ $? -ne 0 ]; then
    echo ''
    echo '❌ Mobile database generation failed!'
    exit 1
fi
echo ''

# Step 8: Generate manifests
echo '📄 Step 7: Generating manifests...'
python3 generate_db_manifest.py
if [ $? -ne 0 ]; then
    echo ''
    echo '❌ Database manifest generation failed!'
    exit 1
fi

python3 generate_image_manifest.py
if [ $? -ne 0 ]; then
    echo ''
    echo '⚠️  Warning: Image manifest generation failed (images may not sync properly)'
fi
echo ''

echo '================================================'
echo '✅ Workflow completed successfully!'
echo '================================================'
echo ''
echo 'Summary:'
echo '  - cards.yaml validated'
echo '  - Mobile database generated: srg_cards_mobile.db'
echo '  - Database manifest: db_manifest.json'
echo '  - Image manifest: images_manifest.json'
echo ''
echo "📝 Full log saved to: $LOG_FILE"
echo ''
