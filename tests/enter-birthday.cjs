module.exports = async function openInvitation(page) {
  await page.getByRole('button', {name: '打开属于你的惊喜', exact: true}).click();
  await page.locator('#start').waitFor({state: 'visible'});
};
