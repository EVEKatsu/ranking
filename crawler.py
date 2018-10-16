import sys
import os
import time
import urllib.error
import urllib.request

import json
import hjson
from pymongo import MongoClient

BASE_PATH = os.path.join('.', 'docs')

def get_json(api_url):
    while(True):
        try:
            with urllib.request.urlopen(api_url) as url:
                data = json.loads(url.read().decode())
            print('Download: ' + api_url)
            time.sleep(2)
            return data
        except urllib.error.HTTPError:
            print('urllib.error.HTTPError: ' + api_url)
            time.sleep(60)

def main():
    year = str(int(sys.argv[1]))
    month = str(int(sys.argv[2]))

    killmails = MongoClient('localhost:27017')['evekatsu_ranking']['killmails']

    with open('target_players.hjson', 'r') as file:
        target_players = hjson.load(file)

    for player_key, player_ids in target_players.items():
        for player_id in player_ids:
            limit = 1
            while(True):
                zkb_url = 'https://zkillboard.com/api/%sID/%d/year/%s/month/%s/page/%d/' % (
                    player_key,
                    player_id,
                    year,
                    month,
                    limit,
                )

                zkb_list = get_json(zkb_url)
                for zkb in zkb_list:
                    killmail_id = zkb['killmail_id']
                    killmail = zkb.copy()
                    killmail['_id'] = killmail_id

                    if not killmails.find_one({'_id': killmail_id}):
                        esi_url = 'https://esi.evetech.net/latest/killmails/%d/%s/' % (
                            killmail_id,
                            killmail['zkb']['hash'],
                        )
                        killmail.update(get_json(esi_url))

                    killmails.update_one(
                        { '_id': killmail_id },
                        { '$set': killmail },
                        upsert=True,
                    )

                if len(zkb_list) < 200:
                    break

                limit += 1

if __name__ == '__main__':
    main()
