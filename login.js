
const token = process.env.BOT_TOKEN;
const chatId = process.env.CHAT_ID;
const accounts = process.env.ACCOUNTS;

if (!accounts) {
  console.log('❌ 未配置账号');
  process.exit(1);
}

// 解析多个账号，支持逗号或分号分隔
const accountList = accounts.split(/[,;]/);

if (accountList.length === 0) {
  console.log('❌ 账号格式错误，应为 username1,username2');
  process.exit(1);
}

async function sendTelegram(message) {
  if (!token || !chatId) return;

  const now = new Date();
  const hkTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  const timeStr = hkTime.toISOString().replace('T', ' ').substr(0, 19) + " HKT";

  const fullMessage = `🎉 Netlib(auth-webip) 登录通知\n\n登录时间：${timeStr}\n\n${message}`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: fullMessage
      }),
      signal: AbortSignal.timeout(10000)
    });
    console.log('✅ Telegram 通知发送成功');
  } catch (e) {
    console.log('⚠️ Telegram 发送失败');
  }
}

async function loginWithAccount(user, index) {
  console.log(`\n🚀 开始登录账号: ${index}`);
  
  let result = { user, success: false, message: '' };
  
  try {    
    console.log(`📱 ${index} - 正在访问网站...`);
    const data = await fetch(user);
    
    if (data.status === 200) {
      console.log(`✅ ${index} - 登录成功`);
      result.success = true;
      result.message = `✅ ${user} 登录成功`;
    } else {
      console.log(`❌ ${index} - 登录失败`);
      result.message = `❌ ${user} 登录失败`;
    }
    
  } catch (e) {
    console.log(`❌ ${index} - 登录异常: ${e.message}`);
    result.message = `❌ ${user} 登录异常: ${e.message}`;
  } finally {

  }
  
  return result;
}

async function main() {
  console.log(`🔍 发现 ${accountList.length} 个账号需要登录`);
  
  const results = [];
  
  for (let i = 0; i < accountList.length; i++) {
    const user = accountList[i];
    console.log(`\n📋 处理第 ${i + 1}/${accountList.length} 个账号: ${i+1}`);
    
    const result = await loginWithAccount(user, i+1);
    results.push(result);
    
    // 如果不是最后一个账号，等待一下再处理下一个
    if (i < accountList.length - 1) {
      console.log('⏳ 等待1秒后处理下一个账号...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // 汇总所有结果并发送一条消息
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  let summaryMessage = `📊 登录汇总: ${successCount}/${totalCount} 个账号成功\n\n`;
  
  results.forEach(result => {
    summaryMessage += `${result.message}\n`;
  });
  // console.log('summaryMessage>>>',summaryMessage);
  
  
  await sendTelegram(summaryMessage);
  
  console.log('\n✅ 所有账号处理完成！');
}

main().catch(console.error);
