var APs = [];
var FCs = [];

const { default: data } = await import("./songs.json", {
    with: {
        type: "json",
    },
});


export function getData() {
    return data;
}

export function getOrderedLevelTable() {
    const levelTable = data.flatMap(song => {
        const { lvlTab, lvlDiffs, ...songData } = song;
        return lvlTab.map((lvl, index) => ({
            ...songData,
            lvl,
            difficulty: lvlDiffs[index]
        }));
    });

    return levelTable.sort((a, b) => b.lvl - a.lvl);
}

// only setters because the table gets pushed to EJS so it's easier to edit
export function setAPs(tab) {
    APs = tab;
    console.table(APs)
}

export function setFCs(tab) {
    FCs = tab;
    console.table(FCs)
}

export default {
    getData,
    getOrderedLevelTable,
    setAPs,
    setFCs
}
