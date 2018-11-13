import sys
import os

import json
import hjson
from collections import OrderedDict


ROOT_PATH = os.path.join('.', 'docs')
DEBUG = os.getenv('EVEKATSU_DEBUG') in ['True', 'true', 'TRUE']

PLAYERS = OrderedDict([
    (
        'character', {
            'parents': ['corporation', 'alliance'],
            'limit': 99,
        }
    ), (
        'corporation', {
            'parents': ['alliance'],
            'limit': 99,
        }
    ), (
        'alliance', {
            'parents': [],
            'limit': 99,
        }
    )
])

FILTERS = OrderedDict([
    (
        'solo', {
            'condition': lambda killmail: killmail['zkb']['solo'],
            'sort': lambda x: x['points_destroyed'],
        }
    ), (
        'small_gangs', {
            'condition': lambda killmail: killmail['zkb']['points'] > 1 and len(killmail['attackers']) < 100,
            'sort': lambda x: x['points_destroyed'],
        }
    ), (
       'brawlers', {
            'condition': lambda killmail: killmail['zkb']['points'] <= 1 and len(killmail['attackers']) < 100,
            'sort': lambda x: x['ships_destroyed'],
       }
    ), (
        'big_fighters', {
            'condition': lambda killmail: len(killmail['attackers']) >= 100,
            'sort': lambda x: x['isk_destroyed'],
        }
    ),
])

result_players = OrderedDict()
target_players = {}
killmails = {}

def get_ship_result(ships, ship_type_id):
    if (ship_type_id not in ships):
        ships[ship_type_id] = OrderedDict([
            ('ships_destroyed', 0),
            ('ships_lost', 0),
            ('points_destroyed', 0),
            ('points_lost', 0),
            ('isk_destroyed', 0),
            ('isk_lost', 0),
        ])

    return ships[ship_type_id]

def get_player_results(player_ids, player_key, filter_key):
    target_player_id = player_ids[player_key]
    players = result_players[player_key][filter_key]
    if target_player_id not in players:
        players[target_player_id] = OrderedDict([
            ('ships', {}),
        ])

        if target_player_id != -1:
            for parent_key in PLAYERS[player_key]['parents']:
                parent_id = player_ids[parent_key]
                if parent_id != -1:
                    players[target_player_id][parent_key + '_id'] = parent_id

    return players[target_player_id]

def get_player_ids(items):
    player_ids = {}

    for key in PLAYERS.keys():
        id_name = key + '_id'
        if id_name in items:
            player_ids[key] = items[id_name]
        else:
            player_ids[key] = -1

    return player_ids

def lost(killmail):
    player_ids = get_player_ids(killmail['victim'])

    for player_key in PLAYERS.keys():
        if player_ids[player_key] in target_players[player_key]:
            for target_player_key in PLAYERS.keys():
                for filter_key in FILTERS.keys():
                    if FILTERS[filter_key]['condition'](killmail):
                        target = get_ship_result(
                            get_player_results(player_ids, target_player_key, filter_key)['ships'],
                            killmail['victim']['ship_type_id'],
                        )
                        target['ships_lost'] += 1
                        target['points_lost'] += killmail['zkb']['points']
                        target['isk_lost'] += killmail['zkb']['totalValue']
                        break

def destroyed(killmail):
    lost_player_keys = get_player_ids(killmail['victim']).keys()

    used_attacker_ids = {}
    for key in PLAYERS.keys():
        used_attacker_ids[key] = []

    for attacker in killmail['attackers']:
        attacker_ids = get_player_ids(attacker)

        exists = False
        for key in PLAYERS.keys():
            if attacker_ids[key] in target_players[key]:
                exists = True
                break

        if not exists:
            continue

        for player_key in PLAYERS.keys():
            attacker_target_id = attacker_ids[player_key]

            if attacker_target_id in used_attacker_ids[player_key] or attacker_target_id in lost_player_keys:
                continue

            used_attacker_ids[player_key].append(attacker_target_id)

            for filter_key in FILTERS.keys():
                if FILTERS[filter_key]['condition'](killmail):
                    target = get_ship_result(
                        get_player_results(attacker_ids, player_key, filter_key)['ships'],
                        killmail['victim']['ship_type_id'],
                    )
                    target['ships_destroyed'] += 1
                    target['points_destroyed'] += killmail['zkb']['points']
                    target['isk_destroyed'] += killmail['zkb']['totalValue']
                    break

def download(limit_players_keys, result_players):
    root_path = os.path.abspath(os.path.join('..', 'data'))
    sys.path.append(root_path)
    from common import download_images
    from common import get_players_information_by_esi

    all_players = {}
    for player_key, filters in limit_players_keys.items():
        all_players[player_key] = {}
        for filter_key, player_ids in filters.items():
            for player_id in player_ids:
                if player_id not in all_players[player_key]:
                    player = result_players[player_key][filter_key][player_id]
                    value = {}
                    for key in ['corporation_id', 'alliance_id']:
                        if key in player:
                            value[key] = player[key]
                    all_players[player_key][player_id] = value

    for player_key, player_ids in all_players.items():
        for player_id in player_ids.keys():
            download_images(os.path.join(root_path, 'docs'), player_key, player_id, 32, reload=not DEBUG)
    
    return get_players_information_by_esi(all_players)

def main():
    year = str(int(sys.argv[1]))
    month = str(int(sys.argv[2]))
    base_path = os.path.join(ROOT_PATH, year, month)
    os.makedirs(base_path, exist_ok=True)

    global target_players
    with open('target_players.hjson', 'r') as file:
        target_players = hjson.load(file)

    next_year = int(year)
    next_month = int(month) + 1
    if next_month > 12:
        next_year += 1
        next_month = 1

    from pymongo import MongoClient
    found_killmails = MongoClient('localhost:27017')['evekatsu_ranking']['killmails'].find({
        'killmail_time': {
            '$gte': '{0}-{1:02d}-01T00:00:00Z'.format(year, int(month)),
            '$lt':  '{0}-{1:02d}-01T00:00:00Z'.format(next_year, next_month),
        }
    })

    for killmail in found_killmails:
        killmails[killmail['killmail_id']] = killmail

    for player_key in PLAYERS.keys():
        result_players[player_key] = OrderedDict()
        for filter_key in FILTERS.keys():
            result_players[player_key][filter_key] = {}

    for killmail in killmails.values():
        lost(killmail)
        destroyed(killmail)

    for player_key in PLAYERS.keys():
        for filter_key in FILTERS.keys():
            if -1 in result_players[player_key][filter_key]:
                del result_players[player_key][filter_key][-1]

    def get_compression_list(raw_dict, filter_key, limit):
        compression_list = []
        limit_players = {}

        for player_key, items in raw_dict.items():
            sort_value = 0
            
            for ship in items['ships'].values():
                sort_value += FILTERS[filter_key]['sort'](ship)

            limit_players[player_key] = sort_value

        player_keys = []
        for item in sorted(limit_players.items(), key=lambda x: x[1], reverse=True)[:limit]:
            if int(item[1]) == 0:
                continue

            player_key = item[0]
            player_list = [player_key, []]
            player_keys.append(player_key)
            for key, value in raw_dict[player_key].items():
                if key == 'ships':
                    ship_lists = []
                    for ship_type_id, ships in value.items():
                        ship_list = [ship_type_id, []]
                        for ship_value in ships.values():
                            ship_list[1].append(ship_value)
                        ship_lists.append(ship_list)
                    player_list[1].extend(ship_lists)

            compression_list.append(player_list)

        return (compression_list, player_keys)

    compression_players = []
    limit_players_keys = {}
    for player_key in PLAYERS.keys():
        compression_lists = []
        limit_players_keys[player_key] = {}
        for filter_key in FILTERS.keys():
            list_, keys = get_compression_list(
                result_players[player_key][filter_key],
                filter_key,
                PLAYERS[player_key]['limit'],
            )
            compression_lists.append(list_)
            limit_players_keys[player_key][filter_key] = keys
        compression_players.append(compression_lists)

    def write(filename, target):
        with open(os.path.join(base_path, filename), 'w', encoding='utf-8') as file:
            file.write(''.join(str(target).split()))

    def write_json(filename, target, indent=None):
            with open(os.path.join(base_path, filename), 'w', encoding='utf-8') as file:
                json.dump(target, file, indent=indent)

    if DEBUG:
        write_json('players.json', result_players, 4)
        write_json('players.min.json', compression_players, 2)
    else:
        write('players.min.json', compression_players)

    write_json('players_information.json', download(limit_players_keys, result_players))

if __name__ == '__main__':
    main()
