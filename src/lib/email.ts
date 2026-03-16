/**
 * 邮件发送模块
 * 
 * @文件说明 提供邮件发送功能，支持报表订阅、通知等
 * @作者 应亮
 * @创建日期 2026-03-16
 * @最后更新 2026-03-16
 */

/**
 * 邮件接口
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

/**
 * 邮件附件接口
 */
export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  encoding?: 'base64' | 'utf-8';
  contentType?: string;
}

/**
 * 邮件发送结果
 */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * 发送单个邮件
 * 
 * @param message 邮件对象
 * @returns 发送结果
 * 
 * @说明 当前为占位实现，需要集成真实的邮件服务（如 SendGrid、SMTP 等）
 * 
 * @示例
 * const result = await sendEmail({
 *   to: 'user@example.com',
 *   subject: '测试邮件',
 *   html: '<h1>你好</h1>'
 * });
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  try {
    // TODO: 集成真实的邮件服务
    // 方案 1: 使用 SendGrid
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // await sgMail.send({
    //   to: message.to,
    //   from: process.env.EMAIL_FROM,
    //   subject: message.subject,
    //   html: message.html,
    //   text: message.text
    // });
    
    // 方案 2: 使用 SMTP (nodemailer)
    // const nodemailer = require('nodemailer');
    // const transporter = nodemailer.createTransport({...});
    // await transporter.sendMail({...});
    
    // 开发环境：打印邮件内容到控制台
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 邮件发送（开发模式）:');
      console.log('  收件人:', message.to);
      console.log('  主题:', message.subject);
      console.log('  内容:', message.html.substring(0, 100) + '...');
      
      return {
        success: true,
        messageId: `dev-${Date.now()}`
      };
    }
    
    // 生产环境：如果没有配置邮件服务，返回成功但不实际发送
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
      console.warn('⚠️  邮件服务未配置，跳过发送');
      return {
        success: true,
        messageId: 'skipped'
      };
    }
    
    // TODO: 实现真实邮件发送
    console.warn('⚠️  邮件发送功能待实现');
    return {
      success: true,
      messageId: 'pending'
    };
  } catch (error) {
    console.error('❌ 邮件发送失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

/**
 * 批量发送邮件
 * 
 * @param messages 邮件列表
 * @returns 发送结果列表
 * 
 * @示例
 * const results = await sendBatchEmail([
 *   { to: 'user1@example.com', subject: '通知 1', html: '...' },
 *   { to: 'user2@example.com', subject: '通知 2', html: '...' }
 * ]);
 */
export async function sendBatchEmail(messages: EmailMessage[]): Promise<EmailResult[]> {
  const results: EmailResult[] = [];
  
  for (const message of messages) {
    const result = await sendEmail(message);
    results.push(result);
  }
  
  return results;
}

/**
 * 发送报表订阅邮件
 * 
 * @param email 收件人邮箱
 * @param reportName 报表名称
 * @param reportUrl 报表链接
 * @param period 报表周期
 * @returns 发送结果
 * 
 * @示例
 * await sendReportEmail(
 *   'user@example.com',
 *   '利润报表',
 *   'https://erp.example.com/reports/profit',
 *   '2026 年 3 月'
 * );
 */
export async function sendReportEmail(
  email: string,
  reportName: string,
  reportUrl: string,
  period: string
): Promise<EmailResult> {
  const subject = `📊 ${reportName} - ${period}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">${reportName}</h2>
      <p>您好，</p>
      <p>您订阅的报表已生成，请点击下方链接查看：</p>
      <p>
        <a href="${reportUrl}" 
           style="display: inline-block; padding: 10px 20px; background-color: #0070f3; color: white; text-decoration: none; border-radius: 5px;">
          查看报表
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">
        报表周期：${period}<br>
        生成时间：${new Date().toLocaleString('zh-CN')}
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #999; font-size: 12px;">
        如果您不想再接收此类邮件，请
        <a href="${reportUrl}/unsubscribe" style="color: #999;">取消订阅</a>
      </p>
    </div>
  `;
  
  return await sendEmail({
    to: email,
    subject,
    html
  });
}

/**
 * 发送订阅确认邮件
 * 
 * @param email 收件人邮箱
 * @param reportName 报表名称
 * @param confirmUrl 确认链接
 * @returns 发送结果
 */
export async function sendConfirmationEmail(
  email: string,
  reportName: string,
  confirmUrl: string
): Promise<EmailResult> {
  const subject = `请确认订阅：${reportName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">确认订阅</h2>
      <p>您好，</p>
      <p>您正在订阅 <strong>${reportName}</strong>，请点击下方按钮确认：</p>
      <p>
        <a href="${confirmUrl}" 
           style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px;">
          确认订阅
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">
        如果这不是您的操作，请忽略此邮件。
      </p>
    </div>
  `;
  
  return await sendEmail({
    to: email,
    subject,
    html
  });
}

/**
 * 发送系统通知邮件
 * 
 * @param email 收件人邮箱
 * @param subject 邮件主题
 * @param message 消息内容
 * @param type 消息类型（info/warning/error）
 * @returns 发送结果
 */
export async function sendNotificationEmail(
  email: string,
  subject: string,
  message: string,
  type: 'info' | 'warning' | 'error' = 'info'
): Promise<EmailResult> {
  const colors = {
    info: '#0070f3',
    warning: '#f5a623',
    error: '#d0021b'
  };
  
  const icons = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌'
  };
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${colors[type]};">${icons[type]} ${subject}</h2>
      <div style="padding: 15px; background-color: #f5f5f5; border-left: 4px solid ${colors[type]};">
        <p style="margin: 0;">${message}</p>
      </div>
      <p style="color: #999; font-size: 12px; margin-top: 20px;">
        Trade ERP 系统通知<br>
        ${new Date().toLocaleString('zh-CN')}
      </p>
    </div>
  `;
  
  return await sendEmail({
    to: email,
    subject,
    html
  });
}
