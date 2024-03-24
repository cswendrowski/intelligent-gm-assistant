export async function ready() {

    await createOrGetThread();
}

async function createOrGetThread() {
    let oldThreadId = game.settings.get("intelligent-gm-assistant", "threadId");
    let worldThreadIds = game.settings.get("intelligent-gm-assistant", "threadIds");
    let userThreadId = worldThreadIds[game.user.id] || "";
    let userThreadIds = game.settings.get("intelligent-gm-assistant", "userThreadIds");
    let userThreadWorldId = userThreadIds[game.world.id];

    if (oldThreadId) {
        userThreadIds[game.world.id] = oldThreadId;
        game.settings.set("intelligent-gm-assistant", "threadId", undefined);
        game.settings.set("intelligent-gm-assistant", "userThreadIds", userThreadIds);
        console.log("Migrated threadId to userThreadIds");
    }
    else if (userThreadId) {
        userThreadIds[game.world.id] = userThreadId;
        delete worldThreadIds[game.user.id];
        game.settings.set("intelligent-gm-assistant", "threadIds", worldThreadIds);
        game.settings.set("intelligent-gm-assistant", "userThreadIds", userThreadIds);
        console.log("Migrated world threadId to userThreadIds");
    }
    else if (!userThreadWorldId) {
        userThreadId = await game.modules.get("intelligent-gm-assistant").api.createThread();
        userThreadIds[game.world.id] = userThreadId;
        game.settings.set("intelligent-gm-assistant", "userThreadIds", userThreadIds);
    }
}
