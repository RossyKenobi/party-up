const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 格式化时间为微信模板消息要求的格式 (2026年05月24日 12:34)
function formatDateTime(dateStr) {
  const d = new Date(dateStr);
  // 转为东八区时间
  const beijingTime = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const year = beijingTime.getUTCFullYear();
  const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(beijingTime.getUTCDate()).padStart(2, '0');
  const h = String(beijingTime.getUTCHours()).padStart(2, '0');
  const m = String(beijingTime.getUTCMinutes()).padStart(2, '0');
  return `${year}年${month}月${day}日 ${h}:${m}`;
}

exports.main = async (event, context) => {
  try {
    const now = Date.now();
    
    // 查询设置了提醒，且尚未提醒的活动
    const { data: events } = await db.collection('events').where({
      reminder: _.gt(0),
      reminded: _.neq(true)
    }).get();

    for (const evt of events) {
      const startTime = new Date(evt.startTime).getTime();
      const reminderMs = evt.reminder * 60 * 1000;
      
      // 如果当前时间已经达到了需要提醒的时间
      if (now >= startTime - reminderMs) {
        
        // 找出所有参与者的 openid
        const openIds = [];
        for (const pid of evt.participants) {
           const userRes = await db.collection('users').where({ id: pid }).get();
           if (userRes.data.length > 0 && userRes.data[0]._openid) {
               openIds.push(userRes.data[0]._openid);
           }
        }

        // 遍历发送订阅消息
        for (const openId of openIds) {
          try {
            await cloud.openapi.subscribeMessage.send({
              touser: openId,
              templateId: 'o5ZWZwaz05Rr4yZoXEcGJfFxa2hF_dc4E9fsIrhK2NU',
              page: `pages/detail/detail?id=${evt.id}`,
              lang: 'zh_CN',
              data: {
                thing6: { value: (evt.title || '活动').substring(0, 20) },
                date2: { value: formatDateTime(evt.startTime) },
                date3: { value: formatDateTime(evt.endTime) },
                thing4: { value: (evt.location || '待定').substring(0, 20) },
                thing9: { value: '您的活动即将开始，请做好准备！' }
              }
            });
            console.log(`Sent reminder to ${openId} for event ${evt.title}`);
          } catch (sendErr) {
            console.error(`Failed to send reminder to ${openId}:`, sendErr);
          }
        }

        // 标记为已提醒，避免重复发送
        await db.collection('events').doc(evt._id).update({
          data: {
            reminded: true
          }
        });
      }
    }
    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false, error: err };
  }
};
