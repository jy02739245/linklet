/**
 * @api {post} /short Create
 */

// Path: functions/create.js

function generateRandomString(length) {
    const characters = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters.charAt(randomIndex);
    }

    return result;
}

export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400', // 24小时
            },
        });
    }
// export async function onRequestPost(context) {
    const { request, env } = context;
    const originurl = new URL(request.url);
    const clientIP = request.headers.get("x-forwarded-for") || request.headers.get("clientIP");
    const userAgent = request.headers.get("user-agent");
    const origin = `${originurl.protocol}//${originurl.hostname}`

    const options = {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    const timedata = new Date();
    const formattedDate = new Intl.DateTimeFormat('zh-CN', options).format(timedata);
    const formData = await request.formData();
    const longUrl = formData.get("longUrl");
    const slug = formData.get("shortKey");
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400', // 24 hours
    };
    if (!longUrl) return Response.json({ message: 'Missing required parameter: longUrl.' });
    let finalLongUrl = longUrl;  // 新增变量保存处理后的URL

    // 检查 longUrl 是否是 base64 字符串（简单判断：只能包含 A-Z, a-z, 0-9, +, /, =）
    const base64Pattern = /^[A-Za-z0-9+/=]+$/;
    if (longUrl && base64Pattern.test(longUrl)) {
        try {
            // 尝试 base64 解码
            const decoded = atob(longUrl);
    
            // 如果解码后是个 http/https URL，就替换掉
            if (/^https?:\/\/.{3,}/.test(decoded)) {
                finalLongUrl = decoded;
            }
        } catch (err) {
            // 如果解码失败，就忽略，继续用原始 longUrl
            console.log("Base64 decode failed, fallback to original longUrl:", err.message);
        }
    }
    // url格式检查
    if (!/^https?:\/\/.{3,}/.test(finalLongUrl)) {
        return Response.json({ Code: 0,Message: 'Illegal format: longUrl.' },{
            headers: corsHeaders,
            status: 400
        })
    }

    // 自定义slug长度检查 2<slug<10 是否不以文件后缀结尾
    if (slug && (slug.length < 2 || slug.length > 10 || /.+\.[a-zA-Z]+$/.test(slug))) {
        return Response.json({ Code: 0, Message: 'Illegal length: slug, (>= 2 && <= 10), or not ending with a file extension.' },{
            headers: corsHeaders,
            status: 400
        
        });
    }




    try {

        // 如果自定义slug
        if (slug) {
            const existUrl = await env.DB.prepare(`SELECT url as existUrl FROM links where slug = '${slug}'`).first()

            // url & slug 是一样的。
            if (existUrl && existUrl.existUrl === finalLongUrl) {
                return Response.json({Code: 0, slug, ShortUrl: `${origin}/${slug2}` },{
                    headers: corsHeaders,
                    status: 200
                })
            }

            // slug 已存在
            if (existUrl) {
                return Response.json({Code: 0, Message: 'Slug already exists.' },{
                    headers: corsHeaders,
                    status: 200  
                })
            }
        }

        // 目标 url 已存在
        const existSlug = await env.DB.prepare(`SELECT slug as existSlug FROM links where url = '${finalLongUrl}'`).first()

        // url 存在且没有自定义 slug
        if (existSlug && !slug) {
            return Response.json({Code: 0, slug: existSlug.existSlug, ShortUrl: `${origin}/${existSlug.existSlug}` },{
                headers: corsHeaders,
                status: 200
            
            })
        }
        const bodyUrl = new URL(finalLongUrl);

        if (bodyUrl.hostname === originurl.hostname) {
            return Response.json({Code: 0, Message: 'You cannot shorten a link to the same domain.' }, {
                headers: corsHeaders,
                status: 400
            })
        }

        // 生成随机slug
        const slug2 = slug ? slug : generateRandomString(4);
        // console.log('slug', slug2);

        const info = await env.DB.prepare(`INSERT INTO links (url, slug, ip, status, ua, create_time) 
        VALUES ('${finalLongUrl}', '${slug2}', '${clientIP}',1, '${userAgent}', '${formattedDate}')`).run()

        return Response.json({ Code: 1, slug: slug2, ShortUrl: `${origin}/${slug2}` },{
            headers: corsHeaders,
            status: 200
        })
    } catch (e) {
        // console.log(e);
        return Response.json({ Code: 0,Message: e.message },{
            headers: corsHeaders,
            status: 500
        })
    }



}



