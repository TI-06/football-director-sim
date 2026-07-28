export async function authenticateCloudAction(client, action, userId, password) {
  if (action === 'register') {
    await client.register(userId, password);
    await client.login(userId, password);
    return;
  }
  await client.login(userId, password);
}
