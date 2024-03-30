import { promises as fs } from "fs"
import fnv from "fnv-plus"

import cdragon from "./src/cdragon.mjs"
import ddragon from "./src/ddragon.mjs"
import utils from "./src/utils.mjs"
import versions from "./src/versions.mjs"

const get_icon = path =>
  `https://raw.communitydragon.org/${versions.cdragon}/game/${path.toLowerCase().replace(/\.(tex|dds)$/gi, '.png')}`

const replace_description_attributes = (description, effects) => {
    const attributes = description.match(/@(.*?)@/gi)
    effects = utils.combine_objects(
        Object.entries(effects).map(([k, v]) => ({ [k.toLowerCase()]: v }))
    )

    const process_value = (value, attribute) => {
        if(Number.isFinite(value)) {
            value *= /10+/gi.test(attribute) ? Number.parseInt(attribute.split('*')[1]) : 1
            value = -1 < value && value < 1 ? value.toFixed(2) : Math.trunc(value)
        }

        return value
    }

    return attributes?.reduce((desc, attribute) => {
        const attribute_sanitized = attribute.replace(/@|(\*10+)/gi, '').toLowerCase()
        const attribute_hex = fnv.hash(attribute_sanitized, 32).hex()
        let value = effects[attribute_sanitized] ?? effects[`{${attribute_hex}}`]

        if(Array.isArray(value)) {
            value = value.map(v => process_value(v, attribute))
            value = value.every(v => v === value[0]) ? value[0] : value.join(" / ")
        }

        value = process_value(value, attribute)

        return desc.replace(attribute, value ?? '?')
    }, description) ?? description
}

const build_component = (ddragon_component, cdragon_component, build_fn) => {
    return utils.combine_objects(
        ddragon_component.map(id => {
            const cdragon_object = cdragon_component.find(element => element.apiName === id)

            if(cdragon_object === undefined)
                return null

            return build_fn(cdragon_object)
        })
    )
}

const traits = build_component(ddragon.traits, cdragon.traits, (trait) => {
    const effects = trait.effects.map(effect => {
        return {
            ...effect,
            ...effect.variables,
        }
    })

    let description = trait.desc
    const expandrow = description.match(/<expandrow>(.*?)<\/expandrow>/gi)?.[0]

    if(expandrow !== undefined) {
        description = description.replace(
            expandrow,
            trait.effects.
                map(() => expandrow.replaceAll(/expandrow>/gi, "row>")).
                join("<br>")
        )
    }

    const rows = description.match(/<row>(.*?)<\/row>/gi)

    description = rows?.reduce((desc, row, i) => {
        return desc.replace(row, replace_description_attributes(row, effects[i]))
    }, description) ?? description

    description = replace_description_attributes(description, effects[0])

    return {
        [trait.apiName]: {
            id:          trait.apiName,
            name:        trait.name,
            icon:        get_icon(trait.icon),
            champions:   [],
            description,
            effects,
        },
    }
})

const champions = build_component(ddragon.champions, cdragon.champions, (champion) => {
    const champion_id = champion.characterName
    const find_trait_from_name = name => Object.values(traits).find(trait => trait.name === name)
    const champion_traits = champion.traits.map(trait_name => find_trait_from_name(trait_name))

    champion_traits.forEach(trait => {
        trait.champions = [...trait.champions, champion_id]
    })

    const effects = utils.combine_objects(
        champion.ability.variables.
            map(({ name, value }) => ({ [name]: Array.isArray(value) ? value.slice(1, 4) : value }))
    )

    const description = replace_description_attributes(champion.ability.desc, effects)

    const ability = {
        ...champion.ability,
        icon: get_icon(champion.ability.icon),
        description,
        effects,
    }

    return {
        [champion_id]: {
            id:        champion_id,
            cost:      champion.cost,
            icon:      get_icon(champion.tileIcon),
            name:      champion.name,
            stats:     champion.stats,
            trait_ids: champion_traits.map(trait => trait.id),
            ability,
        },
    }
})

const augments = build_component(ddragon.augments, cdragon.augments, (augment) => {
    const description = replace_description_attributes(augment.desc, augment.effects)

    return {
        [augment.apiName]: {
            id:                 augment.apiName,
            associatedTraits:   augment.associatedTraits,
            composition:        augment.composition,
            effects:            augment.effects,
            from:               augment.from,
            icon:               get_icon(augment.icon),
            incompatibleTraits: augment.incompatibleTraits,
            name:               augment.name,
            unique:             augment.unique,
            description,
        }
    }
})

const items = build_component(ddragon.items, cdragon.items, (item) => {
    // remove unrelated items
    if(/debug|TFT_Item_UnusableSlot|tft3.*emblem/gi.test(item.apiName) || item.name === "" || item.desc === null || item.name === item.desc)
        return null

    const description = replace_description_attributes(item.desc, item.effects)
    const name = replace_description_attributes(item.name, item.effects)

    return {
        [item.apiName]: {
            id:                 item.apiName,
            associatedTraits:   item.associatedTraits,
            composition:        item.composition,
            effects:            item.effects,
            from:               item.from,
            icon:               get_icon(item.icon),
            incompatibleTraits: item.incompatibleTraits,
            unique:             item.unique,
            name,
            description,
        }
    }
})

/*
console.log(
    [...new Set(
        [augments, champions, items, traits].
            map(value => JSON.stringify(value)).
            join("").
            match(/<(.*?)>/gi)
    )]
)

console.log(
    [...new Set(
        [augments, champions, items, traits].
            map(value => JSON.stringify(value)).
            join("").
            match(/%i:(.*?)%/gi)
    )]
)
*/

await fs.mkdir(versions.ddragon)
fs.writeFile(`${versions.ddragon}/augments.json`, JSON.stringify(augments))
fs.writeFile(`${versions.ddragon}/champions.json`, JSON.stringify(champions))
fs.writeFile(`${versions.ddragon}/items.json`, JSON.stringify(items))
fs.writeFile(`${versions.ddragon}/traits.json`, JSON.stringify(traits))
