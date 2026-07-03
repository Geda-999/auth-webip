import { Redis } from "@upstash/redis";

const token = process.env.BOT_TOKEN;
const chatId = process.env.CHAT_ID;
const accounts = process.env.ACCOUNTS;
const urls = process.env.URLS;
const upstashURL = process.env.UPSTASH_URL;
const upstashToken = process.env.UPSTASH_TOKEN;


// 方式1：显式传入凭证
const redis = new Redis({
  url: upstashURL,
  token: upstashToken,
});

async function getAccounts() {
  if (accounts) {
    // 尝试解析本地 ACCOUNTS 环境变量或常量，优先使用逗号分隔，回退为原始字符串
    try {
      let local = accounts.trim();
      if (local.startsWith("[")) {
        // 尝试 JSON 格式
        return JSON.parse(local);
      }
      if (local.includes(',')) {
        return local.split(',').map(i => i.trim()).filter(Boolean);
      }
      return [local];
    } catch (e) {
      console.error('本地 ACCOUNTS 解析失败:', e);
      return null;
    }
  }
  if (!urls) return null;
  let text;
  try {
    const resp = await fetch(urls);
    text = await resp.text();
    // console.log('list>>>', text);
  } catch (e) {
    console.error('拉取账号列表失败:', e);
    return null;
  }

  // 尝试 JSON.parse，回退为逗号分隔字符串
  try {
    if (text.startsWith('[')) {
      return JSON.parse(text);
    }
    if (text.includes(',')) {
      return text.split(',').map(i => i.trim()).filter(Boolean);
    }
    return [text.trim()];
  } catch (e) {
    console.error('JSON 解析失败:', e);
    return null;
  }
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
      let userDisplay = user.replace(/^https?:\/\//, '');
      result.message = `✅ ${userDisplay} 登录成功`;
 
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

async function handleUpstash() {
  if (!upstashURL || !upstashToken) {
    console.log("❌ Upstash 配置缺失，无法执行 Redis 操作");
    return { success: false, message: "Upstash 配置不完整" };
  }

  try {
    // 1. 创建带过期时间的临时数据
    await redis.setex("tempKey", 60, "临时数据");

    // 2. 设置一个用户年龄
    await redis.set("user:age", 25);

    // 3. 获取并打印用户年龄
    const age1 = await redis.get("user:age");
    console.log(`user:age 初始: ${age1}`);

    // 4. 更新用户年龄
    await redis.set("user:age", 26);

    // 5. 再次获取并打印
    const age2 = await redis.get("user:age");
    console.log(`user:age 更新后: ${age2}`);

    // 6. 删除该 key
    await redis.del("user:age");

    console.log("✅ Upstash Redis 基本操作全部成功");
    return { success: true, message: "Upstash Redis 基本操作全部成功" };
  } catch (err) {
    console.log("⚠️ Upstash Redis 操作失败：", err);
    return { success: false, message: "Upstash Redis 操作失败: " + err.message };
  }
}

async function main() {

  // 测试 Upstash
  const upsMessage = await handleUpstash();
  
  const accountList = await getAccounts();
  // console.log('accountList>>>', accountList);
  // return
  if (!accountList) {
    console.log('❌ 未配置账号');
    process.exit(1);
  }

  // 解析多个账号，支持逗号或分号分隔
  // const accountList = accountsList.split(/[,;]/);

  if (accountList.length === 0) {
    console.log('❌ 账号格式错误，应为 username1,username2');
    process.exit(1);
  }

  console.log(`🔍 发现 ${accountList.length} 个账号需要登录`);
  const results = [];
  
  for (let i = 0; i < accountList.length; i++) {
    const user = accountList[i];
    console.log(`\n📋 处理第 ${i + 1}/${accountList.length} 个账号: ${i+1}`);
    
    const result = await loginWithAccount(user, i+1);
    results.push(result);
    
    // 如果不是最后一个账号，等待一下再处理下一个
    if (i < accountList.length - 1) {
      console.log('⏳ 等待2秒后处理下一个账号...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // 汇总所有结果并发送一条消息
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  let summaryMessage = `📊 Upstash信息: ${upsMessage.message}\n\n📊 登录汇总: ${successCount}/${totalCount} 个账号成功\n\n`;
  
  results.forEach(result => {
    summaryMessage += `${result.message}\n`;
  });
  // console.log('summaryMessage>>>',summaryMessage);
  
  
  await sendTelegram(summaryMessage);
  
  console.log('\n✅ 所有账号处理完成！');
}

main().catch(console.error);
