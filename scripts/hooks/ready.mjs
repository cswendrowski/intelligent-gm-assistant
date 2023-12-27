export async function ready() {

    if ( !game.user.isGM ) return;

    await createOrGetThread();
}

async function createOrGetThread() {
    let threadId = game.settings.get("intelligent-gm-assistant", "threadId");

    if (!threadId) {
        threadId = await game.modules.get("intelligent-gm-assistant").api.createThread();
        game.settings.set("intelligent-gm-assistant", "threadId", threadId);
    }
}
