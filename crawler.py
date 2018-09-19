import sys
import os
import time
import json
import urllib.error
import urllib.request


MODIFIER_IDS = {
    'character': {
        'characterID': [
            94097177, # Lehs Shel
            94570608, # may tenth
            1642815872, # Rancer Apocalypse
            96224663, # Katana Masen
            93658049, # Isana Izanagi
            92851348, # saya K
            95278082, # elebee hatizou
            95235307, # Takuya Gogiko
            95249176, # shu oisibb
            2112087185, # SIGMA ARAMAKI
        ],
    },
    'corporation': {
        'corporationID': [
            98418839, # NACHO Battle Pixies
            98217414, # The Far East Starfleet Academy
            98476559, # C8N8O16
            98463585, # Night's Paladins
            98450869, # GAMILAS Security and Logistic Service
        ],
    },
    'alliance': {
        'allianceID': [
            99001954, # Caladrius Alliance
            99006138, # SAMURAI SOUL'd OUT
        ]
    },
}

BASE_PATH = os.path.join('.', 'docs')

def get_json(modifier_key, modifier_id, year, month):
    json_list = []
    base_url = 'https://zkillboard.com/api/%s/%d/year/%s/month/%s/' % (
        modifier_key,
        modifier_id,
        year,
        month,
    )

    limit = 1
    while(True):
        api_url = base_url + 'page/%d/' % limit

        try:
            with urllib.request.urlopen(api_url) as url:
                data = json.loads(url.read().decode())
            time.sleep(10)
        except urllib.error.HTTPError:
            print('urllib.error.HTTPError: ' + api_url)
            time.sleep(300)
            continue

        if len(data) <= 0:
            print('Download: ' + api_url)
            break

        json_list.extend(data)
        limit += 1

    return json_list

def main():
    year = str(int(sys.argv[1]))
    month = str(int(sys.argv[2]))

    year_path = os.path.join(BASE_PATH, year)
    month_path = os.path.join(year_path, month)

    if not os.path.isdir(year_path):
        os.mkdir(year_path)

    if not os.path.isdir(month_path):
        os.mkdir(month_path)

    for modifier_name in MODIFIER_IDS.keys():
        modifier_path = os.path.join(month_path, modifier_name)
        if not os.path.isdir(modifier_path):
            os.mkdir(modifier_path)

    for modifier_name, modifier_dict in MODIFIER_IDS.items():
        for modifier_key, modifier_ids in modifier_dict.items():
            for modifier_id in modifier_ids:
                json_path = os.path.join(month_path, modifier_name, '%d.json' % modifier_id)
                data = get_json(modifier_key, modifier_id, year, month)
                if len(data) > 0:
                    with open(json_path, 'w', encoding='utf-8') as file:
                        json.dump(data, file, indent=4)

if __name__ == '__main__':
    main()
