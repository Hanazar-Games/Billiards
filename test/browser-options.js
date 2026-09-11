export const browserOptions = {
  headless: true,
  args: ['--no-sandbox', ...(process.env.CI
    ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    : ['--enable-gpu'])],
};

export async function prepareBrowserPage(page) {
  if (!process.env.CI) return;
  await page.evaluateOnNewDocument(() => {
    if (!localStorage.getItem('billiards_settings_v1')) {
      localStorage.setItem('billiards_settings_v1', JSON.stringify({
        quality: 'low', shadowsEnabled: false, antialiasEnabled: false, renderScale: 0.5,
      }));
    }
  });
}
