import sys
import os
import time
import json
import urllib.error
import urllib.request


MODIFIERS = {
    'character': {
        'esi': 'v4/characters',
        'ext': '.jpg',
        'tickers': ['corporation', 'alliance'],
    },
    'corporation': {
        'esi': 'v4/corporations',
        'ext': '.png',
        'tickers': ['alliance'],
    },
    'alliance': {
        'esi': 'v3/alliances',
        'ext': '.png',
        'tickers': [],
    },
}
ROOT_PATH = os.path.join('.', 'docs')

debug = True
result_modifiers = {}
target_modifiers = {}
killmails = {}


def get_modifer_results(modifier_key, modifier_ids):
    target_id = modifier_ids[modifier_key]
    modifiers = result_modifiers[modifier_key]
    if target_id not in modifiers:
        modifiers[target_id] = {
            'ships_destroyed': 0,
            'ships_lost': 0,
            'points_destroyed': 0,
            'points_lost': 0,
            'isk_destroyed': 0,
            'isk_lost': 0,
        }

        if target_id != -1:
            for ticker_key in MODIFIERS[modifier_key]['tickers']:
                ticker_id = modifier_ids[ticker_key]
                if ticker_id != -1:
                    modifiers[target_id][ticker_key + '_id'] = ticker_id

            api_url = 'https://esi.evetech.net/%s/%d/' % (MODIFIERS[modifier_key]['esi'], target_id)
            with urllib.request.urlopen(api_url) as url:
                json_dict = json.loads(url.read().decode())
                for key in ['name', 'ticker']:
                    if key in json_dict:
                        modifiers[target_id][key] = json_dict[key]

            ext = MODIFIERS[modifier_key]['ext']
            image_url = 'https://image.eveonline.com/%s/%d_64%s' % (modifier_key, target_id, ext)
            image_path = os.path.join(ROOT_PATH, 'images', modifier_key, '%d%s' % (target_id, ext))
            if not (debug and os.path.isfile(image_path)):
                try:
                    data = urllib.request.urlopen(image_url).read()
                    with open(image_path, mode="wb") as f:
                        f.write(data)
                except urllib.error.URLError as e:
                    print(e)

                time.sleep(10)

    return modifiers[target_id]

def get_modifier_ids(items):
    modifier_ids = {}

    for key in MODIFIERS.keys():
        id_name = key + '_id'
        if id_name in items:
            modifier_ids[key] = items[id_name]
        else:
            modifier_ids[key] = -1

    return modifier_ids

def lost(killmail):
    modifier_ids = get_modifier_ids(killmail['victim'])

    for key in MODIFIERS.keys():
        if modifier_ids[key] in target_modifiers[key]:
            for key2 in MODIFIERS.keys():
                target = get_modifer_results(key2, modifier_ids)
                target['ships_lost'] += 1
                target['points_lost'] += killmail['zkb']['points']
                target['isk_lost'] += killmail['zkb']['totalValue']

def destroyed(killmail):
    lost_ids = get_modifier_ids(killmail['victim'])

    target_ids = {}
    for key in MODIFIERS.keys():
        target_ids[key] = []

    for attacker in killmail['attackers']:
        attacker_ids = get_modifier_ids(attacker)

        exists = False
        for key in MODIFIERS.keys():
            if attacker_ids[key] in target_modifiers[key]:
                exists = True
                break

        if not exists:
            continue

        for key in MODIFIERS.keys():
            attacker_id = attacker_ids[key]

            if attacker_id in target_ids[key] or attacker_id == lost_ids[key]:
                continue

            target_ids[key].append(attacker_id)
            target = get_modifer_results(key, attacker_ids)
            target['ships_destroyed'] += 1
            target['points_destroyed'] += killmail['zkb']['points']
            target['isk_destroyed'] += killmail['zkb']['totalValue']

def main():
    year = str(int(sys.argv[1]))
    month = str(int(sys.argv[2]))

    for key in MODIFIERS.keys():
        target_modifiers[key] = []
        result_modifiers[key] = {}

    base_path = os.path.join(ROOT_PATH, year, month)
    for key in MODIFIERS.keys():
        for filename in os.listdir(os.path.join(base_path, key)):
            modifier_id, ext = os.path.splitext(filename)
            target_modifiers[key].append(int(modifier_id))

            with open(os.path.join(base_path, key, filename), 'r') as file:
                for killmail in json.load(file):
                    if killmail['killmail_id'] not in killmails:
                        killmails[killmail['killmail_id']] = killmail

    for killmail in killmails.values():
        lost(killmail)
        destroyed(killmail)

    for key in MODIFIERS.keys():
        if -1 in result_modifiers[key]:
            del result_modifiers[key][-1]

    with open(os.path.join(base_path, 'aggregate.json'), 'w', encoding='utf-8') as file:
        json.dump(result_modifiers, file)

if __name__ == '__main__':
    main()
