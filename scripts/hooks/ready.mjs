export async function ready() {

    await createOrGetThread();
}

async function createOrGetThread() {
    let oldThreadId = game.settings.get("intelligent-gm-assistant", "threadId");
    let threadIds = game.settings.get("intelligent-gm-assistant", "threadIds");

    let userThreadId = threadIds[game.user.id] || "";
    if (!userThreadId && oldThreadId) {
        threadIds[game.user.id] = oldThreadId;
        game.settings.set("intelligent-gm-assistant", "threadIds", threadIds);
        game.settings.set("intelligent-gm-assistant", "threadId", undefined);
        console.log("Migrated threadId to threadIds")
    }
    else if (!userThreadId) {
        userThreadId = await game.modules.get("intelligent-gm-assistant").api.createThread();
        threadIds[game.user.id] = userThreadId;
        game.settings.set("intelligent-gm-assistant", "threadIds", threadIds);
    }
}
