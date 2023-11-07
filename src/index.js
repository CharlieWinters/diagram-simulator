export async function init() {
  miro.board.ui.on('icon:click', async () => {
    await miro.board.ui.openModal({url: 'app.html', width: 800, height: 400});
  });
}

init();
