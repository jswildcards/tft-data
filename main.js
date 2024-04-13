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

function find_trait_from_name(traits, name) {
    return Object.values(traits).find(trait => trait.name === name)
}

function get_champions_with_trait(champions, trait) {
    return Object.values(champions).filter(champion => champion.trait_ids.includes(trait.id))
}

async function create_resource_objects(data_dragon, community_dragon, resource_name, create_fn) {
    let resource_objects = {}

    for(const id of data_dragon[resource_name]) {
        if(id in community_dragon[resource_name]) {
            resource_objects = group_objects(
                resource_objects,
                await create_fn(community_dragon[resource_name][id])
            )
        }
    }

    return resource_objects
}

function replace_description_attributes(description, effects, rules) {
    if(is_absent(description) || is_absent(effects))
        return description

    let new_description = description
    const shifted_effects = shift_object_keys(effects, (k) => k.toLowerCase())

    const attributes = description.match(/@(.*?)@/gi) ?? []

    for(const attribute_raw of attributes) {
        const [attribute, amplifier] = attribute_raw.replace(/@|Modified|Total|Scaled/g, "").toLowerCase().split("*")
        const attribute_hex = fnv.hash(attribute, 32).hex()

        let values = shifted_effects[attribute] ?? shifted_effects[`base${attribute}`] ?? shifted_effects[`flat${attribute}`] ?? shifted_effects[`{${attribute_hex}}`] ?? shifted_effects[rules?.[attribute_raw]?.toLowerCase()] ?? "?"

        if(!Array.isArray(values))
            values = [values]

        values = values.map(value => {
            if(is_absent(value))
                return value

            if(is_absent(amplifier))
                return truncate_number(value)

            return truncate_number(value * Number.parseFloat(amplifier))
        })

        if(values.every(value => value === values[0]))
            values = [values[0]]

        new_description = new_description.replace(attribute_raw, values.join(" / "))
    }

    return new_description
}

const versions = await Bun.file(`${import.meta.dir}/versions.json`).json()
const languages = Object.keys(await Bun.file(`${import.meta.dir}/available_languages.json`).json())

const data_dragon = {
    augments:  await fetch_data_dragon_json(`https://ddragon.leagueoflegends.com/cdn/${versions.data_dragon}/data/en_US/tft-augments.json`),
    champions: await fetch_data_dragon_json(`https://ddragon.leagueoflegends.com/cdn/${versions.data_dragon}/data/en_US/tft-champion.json`),
    items:     await fetch_data_dragon_json(`https://ddragon.leagueoflegends.com/cdn/${versions.data_dragon}/data/en_US/tft-item.json`),
    traits:    await fetch_data_dragon_json(`https://ddragon.leagueoflegends.com/cdn/${versions.data_dragon}/data/en_US/tft-trait.json`),
}

console.log(`Using version ${versions.data_dragon} with set ${versions.set}`)

for(const language of languages) {
    console.log(`Generating data in language ${language}...`)

    const community_dragon = await fetch_community_dragon_json(
        `https://raw.communitydragon.org/${versions.community_dragon}/cdragon/tft/${language}.json`,
        versions.set
    )

    const augments = await create_resource_objects(data_dragon, community_dragon, "augments", (augment) => {
        const description = replace_description_attributes(augment.desc, augment.effects)

        let tier = null
        const icon_name = augment.icon.split("/").at(-1).split(".").at(0)

        if(/(i|1)$/gi.test(icon_name))
            tier = 1

        if(/(ii|2)$/gi.test(icon_name))
            tier = 2

        if(/(iii|3)$/gi.test(icon_name))
            tier = 3

        return {
            [augment.apiName]: {
                id:                  augment.apiName,
                associated_traits:   augment.associatedTraits,
                composition:         augment.composition,
                icon:                get_icon_full_url(augment.icon, versions.community_dragon),
                incompatible_traits: augment.incompatibleTraits,
                name:                augment.name,
                unique:              augment.unique,
                tier,
                description,
            }
        }
    })

    const items = await create_resource_objects(data_dragon, community_dragon, "items", (item) => {
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

    const traits = await create_resource_objects(data_dragon, community_dragon, "traits", (trait) => {
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

        const rows = description.match(/<row>(.*?)<\/row>/gi) ?? []

        for(const i in rows) {
            description = description.replace(
                rows[i],
                replace_description_attributes(rows[i], effects[i])
            )
        }

        description = replace_description_attributes(description, effects[0])

        return {
            [trait.apiName]: {
                id:           trait.apiName,
                name:         trait.name,
                icon:         get_icon_full_url(trait.icon, versions.community_dragon),
                champion_ids: [],
                description,
                effects,
            },
        }
    })

    const champions = await create_resource_objects(data_dragon, community_dragon, "champions", async (champion) => {
        const champion_id = champion.characterName
        const trait_ids = champion.traits.map(name => find_trait_from_name(traits, name)).map(trait => trait.id)

        const effects = champion.ability.variables.
            map(({ name, value }) => ({ [name]: Array.isArray(value) ? value.slice(1, 4) : value })).
            reduce(group_objects, {})

        const rules_file = Bun.file(`rules/substitute/champion/ability/description/${versions.set}/${versions.data_dragon}/${champion_id}.json`)

        const description = replace_description_attributes(
            champion.ability.desc,
            effects,
            await rules_file.exists() ? await rules_file.json() : null
        )

        const ability = {
            ...champion.ability,
            icon: get_icon_full_url(champion.ability.icon, versions.community_dragon),
            description,
            effects,
        }


        return {
            [champion_id]: {
                id:        champion_id,
                cost:      champion.cost,
                icon:      get_icon_full_url(champion.tileIcon, versions.community_dragon),
                name:      champion.name,
                stats:     champion.stats,
                trait_ids,
                ability,
            },
        }
    })

    for(const [trait_id, trait] of Object.entries(traits)) {
        traits[trait_id].champion_ids = [...get_champions_with_trait(champions, trait).map(champion => champion.id)]
    }

    await mkdir(`${versions.data_dragon}/${language}`, { recursive: true });
    Bun.write(`${versions.data_dragon}/${language}/augments.json`, JSON.stringify(augments))
    Bun.write(`${versions.data_dragon}/${language}/champions.json`, JSON.stringify(champions))
    Bun.write(`${versions.data_dragon}/${language}/items.json`, JSON.stringify(items))
    Bun.write(`${versions.data_dragon}/${language}/traits.json`, JSON.stringify(traits))
}
