#!/bin/sh

git pull
python3 backup_shared_lists.py backup
python3 create_db.py
python3 backup_shared_lists.py restore
python3 load_cards_from_yaml.py

# Generate mobile database and manifests
echo "Generating mobile database..."
python3 create_mobile_db.py srg_cards_mobile.db cards.yaml

echo "Generating manifests..."
python3 generate_db_manifest.py
python3 generate_image_manifest.py

echo "Workflow complete!"
