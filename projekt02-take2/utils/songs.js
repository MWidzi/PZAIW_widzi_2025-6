const { default: data } = await import("./songs.json", {
    with: {
        type: "json",
    },
});


export function getData() {
    return data;
}

export default {
    getData
}
