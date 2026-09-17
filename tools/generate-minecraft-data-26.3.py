"""Generate native data from official 26.3 reports and Extract26_3 output.

Usage: python3 tools/generate-minecraft-data-26.3.py REPORT_ROOT [UPSTREAM_PROTOCOL]
REPORT_ROOT contains output/reports and extracted.json (see docs/native-26.3.md).
"""
import copy
import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parent.parent
base = root / 'vendor/minecraft-data/pc/26.2'
target = root / 'vendor/minecraft-data/pc/26.3'
target.mkdir(parents=True, exist_ok=True)
reports = pathlib.Path(sys.argv[1]) / 'output/reports'
registries = json.loads((reports / 'registries.json').read_text())
extracted = json.loads((pathlib.Path(sys.argv[1]) / 'extracted.json').read_text())
data = {p.stem: json.loads(p.read_text()) for p in base.glob('*.json')}
old_items = {i['id']: i['name'] for i in data['items']}

def entries(registry):
    return sorted(((key.removeprefix('minecraft:'), value['protocol_id'])
                   for key, value in registries['minecraft:' + registry]['entries'].items()),
                  key=lambda pair: pair[1])

item_ids = dict(entries('item'))

def item_id(old):
    return item_ids[old_items[old]] if old != -1 else -1

previous = {i['name']: i for i in data['items']}
items = []
foods = []
for name, identifier in entries('item'):
    components = json.loads((reports / 'minecraft/components/item' / (name + '.json')).read_text())['components']
    item = copy.deepcopy(previous.get(name, {'name': name, 'displayName': name.replace('_', ' ').title()}))
    item.update(id=identifier, stackSize=components['minecraft:max_stack_size'])
    item.pop('maxDurability', None)
    if 'minecraft:max_damage' in components:
        item['maxDurability'] = components['minecraft:max_damage']
    items.append(item)
    if 'minecraft:food' in components:
        food = components['minecraft:food']
        points = food['nutrition']
        saturation = points * food['saturation'] * 2
        foods.append(dict(item, foodPoints=points, saturation=saturation,
                          effectiveQuality=points+saturation, saturationRatio=saturation/points if points else 0))
data['items'] = items
data['foods'] = foods
previous = {b['name']: b for b in data['blocks']}
blocks = []
shape_ids = {}
shapes = {}
collision = {}
for actual in extracted['blocks']:
    name = actual['name']
    block = copy.deepcopy(previous.get(name, {'name': name, 'displayName': name.replace('_', ' ').title(), 'material': 'default', 'drops': []}))
    block['drops'] = [item_id(i) for i in block['drops']]
    block.update({k: v for k, v in actual.items() if k != 'itemId'})
    block['stackSize'] = items[actual['itemId']]['stackSize']
    block['diggable'] = block['hardness'] >= 0 and name not in ('air', 'cave_air', 'void_air', 'water', 'lava')
    ids = []
    for state in range(block['minStateId'], block['maxStateId'] + 1):
        boxes = extracted['shapes'][str(state)]
        key = json.dumps(boxes, separators=(',', ':'))
        if key not in shape_ids:
            identifier = len(shape_ids)
            shape_ids[key] = identifier
            shapes[str(identifier)] = boxes
        ids.append(shape_ids[key])
    collision[name] = ids[0] if len(set(ids)) == 1 else ids
    block['boundingBox'] = 'block' if extracted['shapes'][str(block['defaultState'])] else 'empty'
    if 'harvestTools' in block:
        block['harvestTools'] = {str(item_id(int(k))): v for k, v in block['harvestTools'].items()}
    blocks.append(block)
data['blocks'] = blocks
data['blockCollisionShapes'] = {'blocks': collision, 'shapes': shapes}
previous = {e['name']: e for e in data['entities']}
data['entities'] = [dict(previous.get(e['name'], {'displayName': e['name'].replace('_', ' ').title(), 'type': 'other', 'category': 'Vehicles' if 'boat' in e['name'] else 'Other'}), **e, internalId=e['id']) for e in extracted['entities']]
data['particles'] = [dict(name=n, id=i) for n, i in entries('particle_type')]
# Sound holders are one-based on the wire (zero denotes an inline sound).
data['sounds'] = [dict(name=n, id=i+1) for n, i in entries('sound_event')]
data['materials'] = {name: {str(item_id(int(i))): v for i, v in tools.items()} for name, tools in data['materials'].items()}
recipes = {}
for identifier, values in data['recipes'].items():
    values = copy.deepcopy(values)
    for recipe in values:
        recipe['result']['id'] = item_id(recipe['result']['id'])
        for key in ('inShape', 'outShape'):
            if key in recipe:
                recipe[key] = [[item_id(i) if isinstance(i, int) else i for i in row] for row in recipe[key]]
        for key in ('ingredients',):
            if key in recipe:
                recipe[key] = [item_id(i) if isinstance(i, int) else i for i in recipe[key]]
    recipes[str(item_id(int(identifier)))] = values
data['recipes'] = recipes
data['version'] = dict(data['version'], version=777, minecraftVersion='26.3', majorVersion='26.3')
protocol = data['protocol']
upstream_path = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else target / 'protocol.json'
if not upstream_path.exists():
    upstream_path = target / 'protocol.json'
if not upstream_path.exists():
    raise FileNotFoundError('Need a 26.3 protocol codec source on the first generation')
upstream = json.loads(upstream_path.read_text())

def container(**fields):
    return ['container', [dict(name=k, type=v) for k, v in fields.items()]]

def array(type_, **kwargs):
    return ['array', dict(type=type_, **(kwargs or {'countType': 'varint'}))]

# Use reviewed 26.2 layouts for sessionId, onlineMode and modern team parameters.
# Upstream 26.3 fixes packed particle colors and item stack templates.
for key in ('GameRule', 'ItemStackTemplate', 'DyeColor', 'Particle'):
    protocol['types'][key] = upstream['types'][key]
# Protodef's compiler shares variable names between anonymous containers;
# template counters must not collide with Slot's public counters.
template = json.dumps(protocol['types']['ItemStackTemplate']).replace('addedComponentCount', 'addedTemplateComponentCount').replace('removedComponentCount', 'removedTemplateComponentCount')
protocol['types']['ItemStackTemplate'] = json.loads(template)
slot_display = protocol['play']['toClient']['types']['SlotDisplay']
protocol['play']['toClient']['types']['SlotDisplay'] = json.loads(json.dumps(slot_display).replace('"Slot"', '"ItemStackTemplate"'))
protocol['types']['Particle'][1][0]['type'][1]['mappings'] = {str(i): n for n, i in entries('particle_type')}
particle_fields = protocol['types']['Particle'][1][1]['type'][1]['fields']
for key, value in json.loads((base / 'protocol.json').read_text())['types']['Particle'][1][1]['type'][1]['fields'].items():
    particle_fields.setdefault(key, value)
fields = protocol['types']['SlotComponent'][1][1]['type'][1]['fields']
upfields = upstream['types']['SlotComponent'][1][1]['type'][1]['fields']
for key in ('use_remainder', 'charged_projectiles', 'bundle_contents', 'container', 'dye', 'base_color', 'wolf/collar', 'tropical_fish/base_color', 'tropical_fish/pattern_color', 'cat/collar', 'sheep/color', 'shulker/color'):
    fields[key] = upfields[key]
fields['attack_animation'] = fields.pop('swing_animation')
fields['interact_animation'] = copy.deepcopy(fields['attack_animation'])
fields['villager_food'] = 'varint'
fields['block_transformer'] = 'varint'
fields['provides_pottery_pattern'] = 'varint'
fields['waxed'] = 'void'
fields['cushion/color'] = 'DyeColor'
fields.pop('map_color')
for name, number in (('ResolvableInt', 'varint'), ('ResolvableFloat', 'f32')):
    protocol['types'][name] = container(constant='bool', value=['switch', {'compareTo': 'constant', 'fields': {'true': number, 'false': 'string'}}])
fields['compostable'] = 'ResolvableInt'
fields['cooking_fuel'] = container(burnTime='ResolvableInt', speedMultiplier='ResolvableFloat')
fields['brewing_fuel'] = container(uses='ResolvableInt', speedMultiplier='ResolvableFloat')
fields['mob_visibility'] = container(entityTypes='IDSet', visibility='f32')
sign = container(messages=array('anonymousNbt', count=4), filteredMessages=['option', array('anonymousNbt', count=4)], color='DyeColor', glowing='bool')
fields['sign_text_front'] = sign
fields['sign_text_back'] = copy.deepcopy(sign)
protocol['types']['SlotComponentType'][1]['mappings'] = {str(i): n for n, i in entries('data_component_type')}
assert set(fields) == {n for n, i in entries('data_component_type')}, set(fields) ^ {n for n, i in entries('data_component_type')}

packets = json.loads((reports / 'packets.json').read_text())
for state in ('configuration', 'play'):
    for direction, report_direction in (('toClient', 'clientbound'), ('toServer', 'serverbound')):
        types = protocol[state][direction]['types']
        names = list(types['packet'][1][0]['type'][1]['mappings'].values())
        if state == 'configuration' and direction == 'toClient':
            names.insert(10, 'post_effects')
            types['packet_post_effects'] = container(effects=array('string'))
        if state == 'play' and direction == 'toClient':
            names.insert(names.index('unload_chunk'), 'add_transient_block')
            names.insert(names.index('respawn'), 'post_effects')
            names.insert(names.index('system_chat'), 'swing_animation')
            types['packet_add_transient_block'] = container(location='position', blockState='varint')
            types['packet_post_effects'] = container(effects=array('string'))
            types['packet_swing_animation'] = container(entityId='varint', hand='varint', animation=fields['attack_animation'])
            types['packet_entity_teleport'] = upstream[state][direction]['types']['packet_entity_teleport']
            types['PositionUpdateRelatives'] = upstream[state][direction]['types']['PositionUpdateRelatives']
        if state == 'play' and direction == 'toServer':
            names.remove('arm_animation')
            names.insert(names.index('recipe_book'), 'arm_animation')
            types['packet_arm_animation'] = container()  # 26.3 punch has no payload.
        actual = sorted(packets[state][report_direction].items(), key=lambda pair: pair[1]['protocol_id'])
        assert len(names) == len(actual)
        types['packet'][1][0]['type'][1]['mappings'] = {f'0x{i:02x}': name for i, name in enumerate(names)}
        old_fields = types['packet'][1][1]['type'][1]['fields']
        types['packet'][1][1]['type'][1]['fields'] = {name: old_fields.get(name, 'packet_' + name) for name in names}
        # Retain official names alongside aliases for review and regression checks.
        manifest = [{'id': v['protocol_id'], 'official': k, 'name': name} for name, (k, v) in zip(names, actual)]
        (target / ('packets-' + state + '-' + direction + '.json')).write_text(json.dumps(manifest, indent=2) + '\n')

# Mojang 26.3 encodes light masks as length-prefixed little-endian BitSet bytes.
# prismarine-chunk still consumes its historical long-pair representation; the
# client plugin converts these buffers at the boundary.
for packet_name in ('packet_map_chunk', 'packet_update_light'):
    for field in protocol['play']['toClient']['types'][packet_name][1]:
        if field['name'] in ('skyLightMask', 'blockLightMask', 'emptySkyLightMask', 'emptyBlockLightMask'):
            field['type'] = 'ByteArray'

# ServerboundAcceptTeleportationPacket now echoes the accepted position too.
protocol['play']['toServer']['types']['packet_teleport_confirm'] = container(
    teleportId='varint', x='f64', y='f64', z='f64', yaw='f32', pitch='f32')

# RecipeDisplay requirements use holder-set codecs whose tagged form cannot be
# represented by the legacy recipe API.  Keep the packet framed and opaque.
protocol['play']['toClient']['types']['packet_recipe_book_add'] = container(data='restBuffer')

# 26.3 MoveEntity uses VecDelta: a properties varint stores on-ground in bit
# zero and the number of 7-byte interpolation steps in the remaining bits.
# Normal entity updates carry at most one step; retain eight steps for delayed
# servers before failing a malformed packet rather than losing framing.
protocol['types']['VecDeltaLinear'] = container(dX='i16', dY='i16', dZ='i16')
protocol['types']['VecDeltaStep'] = container(ticks='varint', dX='i16', dY='i16', dZ='i16')
vec_delta_fields = {'0': 'VecDeltaLinear', '1': 'VecDeltaLinear'}
for steps in range(1, 9):
    for on_ground in range(2):
        vec_delta_fields[str(steps * 2 + on_ground)] = array('VecDeltaStep', count=steps)
vec_delta = ['switch', {'compareTo': 'properties', 'fields': vec_delta_fields}]
protocol['play']['toClient']['types']['packet_rel_entity_move'] = container(entityId='varint', properties='varint', delta=vec_delta)
protocol['play']['toClient']['types']['packet_entity_move_look'] = container(entityId='varint', properties='varint', delta=copy.deepcopy(vec_delta), yaw='i8', pitch='i8')
protocol['play']['toClient']['types']['packet_entity_look'] = container(entityId='varint', onGround='bool', yaw='i8', pitch='i8')

# EntityPositionSync now carries a PositionPath instead of the former velocity
# Vec3. The path starts with its kind: linear has one Vec3, stepped has a
# varint-sized sequence of Vec3/tick-offset pairs. Keeping this separate from
# VecDelta is essential: the sync packet stores absolute positions.
protocol['types']['PositionPathLinear'] = container(x='f64', y='f64', z='f64')
protocol['types']['PositionPathStep'] = container(x='f64', y='f64', z='f64', tickOffset='varint')
position_path = ['switch', {
    'compareTo': 'positionPathType',
    'fields': {
        '0': 'PositionPathLinear',
        '1': array('PositionPathStep')
    }
}]
protocol['play']['toClient']['types']['packet_sync_entity_position'] = container(
    entityId='varint', positionPathType='varint', positionPath=position_path,
    yRot='f32', xRot='f32', onGround='bool')

# PositionedAdvancement moved its coordinates outside optional display data in
# 26.3, so they are present even for entries without a display.
advancement_fields = protocol['play']['toClient']['types']['packet_advancements'][1]
mapping = next(field for field in advancement_fields if field['name'] == 'advancementMapping')
entry_fields = mapping['type'][1]['type'][1]
value = next(field for field in entry_fields if field['name'] == 'value')
value_fields = value['type'][1]
display = next(field for field in value_fields if field['name'] == 'displayData')
display_fields = display['type'][1][1]
display['type'][1][1] = [field for field in display_fields if field['name'] not in ('xCord', 'yCord')]
entry_fields.extend([dict(name='xCord', type='f32'), dict(name='yCord', type='f32')])
for name, value in data.items():
    (target / (name + '.json')).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')
print('Generated native 26.3: %d blocks, %d items, %d entities' % (len(blocks), len(items), len(data['entities'])))
