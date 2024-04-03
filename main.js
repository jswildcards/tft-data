/*
 * Community Dragon:
 * a remote resource that contains all the details of all objects,
 * including augments, champions, items and traits. It may includes
 * data in previous patches.
 *
 * Data Dragon:
 * a remote resource that indicates which objects we actually need
 * in this patch. Only **keys** in data object are what we care. The
 * **values** just tell the locations of images of the object which is
 * not what we want.
 */

import { mkdir } from "node:fs/promises"
import fnv from "fnv-plus"

import {
    fetch_data_dragon_json,
    fetch_community_dragon_json,
} from "./fetch"
import {
    group_objects,
    shift_object_keys,
    is_absent,
    truncate_number,
} from "./util"

function get_icon_full_url(raw_path, community_dragon_version) {
    const path = raw_path.toLowerCase().replace(/\.(tex|dds)$/gi, '.png')
    return `https://raw.communitydragon.org/${community_dragon_version}/game/${path}`
}

function create_resource_objects(resource_name, create_fn) {
    let resource_objects = {}

    for(const id of data_dragon[resource_name]) {
        if(id in community_dragon[resource_name]) {
            resource_objects = group_objects(
                resource_objects,
                create_fn(community_dragon[resource_name][id])
            )
        }
    }

    return resource_objects
}

function replace_description_attributes(description, effects) {
    if(is_absent(description) || is_absent(effects))
        return description

    let new_description = description
    const shifted_effects = shift_object_keys(effects, (k) => k.toLowerCase())

    const attributes = description.match(/@(.*?)@/gi) ?? []

    for(const attribute_raw of attributes) {
        const [attribute, amplifier] = attribute_raw.replace(/@/gi, "").toLowerCase().split("*")
        const attribute_hex = fnv.hash(attribute, 32).hex()

        let values = shifted_effects[attribute] ?? shifted_effects[`{${attribute_hex}}`] ?? "?"

        if(!Array.isArray(values))
            values = [values]

        values = values.map(value => {
            if(is_absent(value))
                return value

            if(is_absent(amplifier))
                return truncate_number(value)

            return truncate_number(value * Number.parseFloat(amplifier))
        })

        new_description = new_description.replace(attribute_raw, values.join(" / "))
    }

    return new_description
}

const versions = await Bun.file(`${import.meta.dir}/versions.json`).json()

const community_dragon = await fetch_community_dragon_json(
    `https://raw.communitydragon.org/${versions.community_dragon}/cdragon/tft/en_us.json`,
    versions.set
)

const data_dragon = {
    augments:  await fetch_data_dragon_json(`https://ddragon.leagueoflegends.com/cdn/${versions.data_dragon}/data/en_US/tft-augments.json`),
    champions: await fetch_data_dragon_json(`https://ddragon.leagueoflegends.com/cdn/${versions.data_dragon}/data/en_US/tft-champion.json`),
    items:     await fetch_data_dragon_json(`https://ddragon.leagueoflegends.com/cdn/${versions.data_dragon}/data/en_US/tft-item.json`),
    traits:    await fetch_data_dragon_json(`https://ddragon.leagueoflegends.com/cdn/${versions.data_dragon}/data/en_US/tft-trait.json`),
}

const augments = create_resource_objects("augments", (augment) => {
    const description = replace_description_attributes(augment.desc, augment.effects)

    return {
        [augment.apiName]: {
            id:                  augment.apiName,
            associated_traits:   augment.associatedTraits,
            composition:         augment.composition,
            icon:                get_icon_full_url(augment.icon, versions.community_dragon),
            incompatible_traits: augment.incompatibleTraits,
            name:                augment.name,
            unique:              augment.unique,
            description,
        }
    }
})

const items = create_resource_objects("items", (item) => {
    const description = replace_description_attributes(item.desc, item.effects)

    return {
        [item.apiName]: {
            id:                  item.apiName,
            associated_traits:   item.associatedTraits,
            composition:         item.composition,
            icon:                get_icon_full_url(item.icon, versions.community_dragon),
            incompatible_traits: item.incompatibleTraits,
            name:                item.name,
            unique:              item.unique,
            description,
        }
    }
})

const traits = create_resource_objects("traits", (trait) => {
    const effects = trait.effects.map(effect => {
        return group_objects(
            effect,
            effect.variables
        )
    })

    let description = trait.desc
    const expandrow = description.match(/<expandrow>(.*?)<\/expandrow>/gi)?.[0]

    if(!is_absent(expandrow)) {
        description = description.replace(
            expandrow,
            Array.from({ length: effects.length }).
                map(() => expandrow.replaceAll(/expandrow>/gi, "row>")).
                join("<br>")
        )
    }

    const rows = description.match(/<row>(.*?)<\/row>/gi)

    if(!is_absent(rows)) {
        for(const i in rows) {
            description = description.replace(
                rows[i],
                replace_description_attributes(rows[i], effects[i])
            )
        }
    }

    description = replace_description_attributes(description, effects[0])

    return {
        [trait.apiName]: {
            id:          trait.apiName,
            name:        trait.name,
            icon:        get_icon_full_url(trait.icon, versions.community_dragon),
            champions:   [],
            description,
            effects,
        },
    }
})

const champions = create_resource_objects("champions", (champion) => {
    const champion_id = champion.characterName

    return {
        [champion_id]: {
            id:        champion_id,
            cost:      champion.cost,
            icon:      get_icon_full_url(champion.tileIcon, versions.community_dragon),
            name:      champion.name,
            stats:     champion.stats,
            // trait_ids: champion_traits.map(trait => trait.id),
            // ability,
        },
    }
})

await mkdir(versions.data_dragon, { recursive: true });
await Bun.write(`${versions.data_dragon}/augments.json`, JSON.stringify(augments))
await Bun.write(`${versions.data_dragon}/champions.json`, JSON.stringify(champions))
await Bun.write(`${versions.data_dragon}/items.json`, JSON.stringify(items))
await Bun.write(`${versions.data_dragon}/traits.json`, JSON.stringify(traits))
