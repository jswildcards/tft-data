import { map_objects_with_key } from "./util"

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

    const all_sets = result.setData
    const current_set = all_sets.find(set => set.mutator === set_version)

    return {
        augments:  map_objects_with_key(result.items, "apiName"),
        champions: map_objects_with_key(current_set.champions, "apiName"),
        items:     map_objects_with_key(result.items, "apiName"),
        traits:    map_objects_with_key(current_set.traits, "apiName"),
    }
}

export {
    fetch_json,
    fetch_data_dragon_json,
    fetch_community_dragon_json,
}

export default {
    fetch_json,
    fetch_data_dragon_json,
    fetch_community_dragon_json,
}
