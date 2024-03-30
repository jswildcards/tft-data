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

async function fetch_json(url) {
    const result = await fetch(url)
    return result.json()
}

async function fetch_data_dragon_json(url) {
    const { data } = await fetch_json(url)

    return Object.keys(data).map(id => {
        return id.split("/").at(-1)
    })
}

async function fetch_community_dragon_json(url, set_version) {
    const result = await fetch_json(url)
    const current_set = result.setData.find(set => set.mutator === set_version)

    return {
        augments:  result.items,
        champions: current_set.champions,
        items:     result.items,
        traits:    current_set.traits,
    }
}

function combine_objects(arr) {
    return arr.
        filter(object => object !== undefined && object !== null).
        reduce((grouped, partial) => {
            return {
                ...grouped,
                ...partial,
            }
        })
}

function get_icon_full_url(raw_path, community_dragon_version) {
    const path = raw_path.toLowerCase().replace(/\.(tex|dds)$/gi, '.png')
    return `https://raw.communitydragon.org/${community_dragon_version}/game/${path}`
}

function create_resource_object(resource_name, create_fn) {
    return combine_objects(
        data_dragon[resource_name].map(id => {
            const community_dragon_resource =
                community_dragon[resource_name].find(resource => resource.apiName === id)

            if(community_dragon_resource === undefined)
                return null

            return create_fn(community_dragon_resource)
        })
    )
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

const augments = create_resource_object("augments", (augment) => {
    return {
        [augment.apiName]: {
            id:                  augment.apiName,
            associated_traits:   augment.associatedTraits,
            composition:         augment.composition,
            effects:             augment.effects,
            from:                augment.from,
            icon:                get_icon_full_url(augment.icon),
            incompatible_traits: augment.incompatibleTraits,
            name:                augment.name,
            unique:              augment.unique,
            description:         augment.desc,
        }
    }
})

const items = create_resource_object("items", (item) => {
    return {
        [item.apiName]: {
            id:                  item.apiName,
            associated_traits:   item.associatedTraits,
            composition:         item.composition,
            effects:             item.effects,
            from:                item.from,
            icon:                get_icon_full_url(item.icon),
            incompatible_traits: item.incompatibleTraits,
            name:                item.name,
            unique:              item.unique,
            description:         item.desc,
        }
    }
})

console.log(items)
