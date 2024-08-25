const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const bodyParser = require('body-parser');
const cnchar = require('cnchar');
const poly = require('cnchar-poly');
const order = require('cnchar-order');
const { JSDOM } = require('jsdom');
const { execFile } = require('child_process');
const puppeteer = require('puppeteer');
const radical = require("cnchar-radical")


// 模拟浏览器环境并解决 CORS 问题
const dom = new JSDOM(`<!DOCTYPE html><div id="drawStroke"></div>`, {
    url: "https://jinghuaiapi.fun",  // 设置为本地 URL
    pretendToBeVisual: true,  // 模拟真实的浏览器环境
    resources: "usable",      // 允许加载资源
    runScripts: "dangerously" // 允许脚本执行
});
global.document = dom.window.document;
global.window = dom.window;

const draw = require('cnchar-draw');

const app = express();
const port = 3000;

app.use(express.json());
app.use(bodyParser.json({ limit: '10mb' })); // 解析 JSON 请求体
cnchar.use(poly, order, draw,radical);

// 第一个代码片段：字符查询相关路由
async function getCharactersByMandarin(mandarin) {
    console.log(`Fetching characters for pinyin: ${mandarin}`);
    try {
        const response = await axios.get(`http://ccdb.hemiola.com/characters/mandarin/${mandarin}`);
        console.log(`Characters fetched:`, response.data);
        return response.data;
    } catch (error) {
        console.error("Error fetching characters by mandarin:", error);
        throw error;
    }
}

async function getCharactersByStrokes(strokes) {
    console.log(`Fetching characters for strokes: ${strokes}`);
    try {
        const response = await axios.get(`http://ccdb.hemiola.com/characters/strokes/${strokes}`);
        console.log(`Characters fetched:`, response.data);
        return response.data;
    } catch (error) {
        console.error("Error fetching characters by strokes:", error);
        throw error;
    }
}

async function getCharactersByRadical(radical) {
    console.log(`Fetching characters for radical: ${radical}`);
    try {
        const response = await axios.get(`http://ccdb.hemiola.com/characters/radicals/${radical}`);
        console.log(`Characters fetched:`, response.data);
        return response.data;
    } catch (error) {
        console.error("Error fetching characters by radical:", error);
        throw error;
    }
}

async function getCharactersByRadicalAndStrokes(rs) {
    console.log(`Fetching characters for radical: ${rs.radical} with strokes: ${rs.strokes}`);
    try {
        const response = await axios.get(`http://ccdb.hemiola.com/characters/radicals/${rs.radical}?strokes=${rs.strokes}`);
        console.log(`Characters fetched:`, response.data);
        return response.data;
    } catch (error) {
        console.error("Error fetching characters by radical and strokes:", error);
        throw error;
    }
}

app.get('/characters', async (req, res) => {
    try {
        const { pinyin, strokes, radical, rs } = req.query;
        let result;

        if (pinyin && !strokes && !radical && !rs) {
            result = await getCharactersByMandarin(pinyin);
        } else if (strokes && !pinyin && !radical && !rs) {
            result = await getCharactersByStrokes(strokes);
        } else if (radical && !strokes && !pinyin && !rs) {
            result = await getCharactersByRadical(radical);
        } else if (rs && !radical && !strokes && !pinyin) {
            const [rsRadical, rsStrokes] = rs.split(',');
            result = await getCharactersByRadicalAndStrokes({ radical: rsRadical, strokes: rsStrokes });
        } else {
            return res.status(400).json({ error: 'Invalid query parameters' });
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while processing your request' });
    }
});

// 处理 GET 请求，获取字符的笔画顺序
app.get('/character/:char', async (req, res) => {
    try {
        console.log(`Received request for character: ${req.params.char}`);
        const cc = req.params.char;
        console.log('Getting stroke order...');
        const strokeOrder = cnchar.stroke(cc, 'order', 'detail');
        console.log('Stroke order:', strokeOrder);

        // Assuming strokeOrder is a 2D array, we'll flatten it to remove the outer array
        const flattenedStrokeOrder = strokeOrder.flat();
        console.log('Flattened Stroke order:', flattenedStrokeOrder);

        res.json(flattenedStrokeOrder);
    } catch (error) {
        console.error('Error in /character/:char:', error);
        res.status(500).json({ error: 'An error occurred while processing your request', details: error.message });
    }
});

app.get('/info/:char', async (req, res) => {
    try {
        const char = req.params.char;
        console.log(`Received request for spell and radical of character: ${char}`);

        // 获取字符的拼音信息
        var spellInfo = cnchar.spell(char, 'array', 'tone', 'poly');
        console.log(`Spell information for '${char}':`, spellInfo);

        // 获取字符的偏旁部首信息
        var radicalInfo = cnchar.radical(char);
        console.log(`Radical information for '${char}':`, radicalInfo);

        // 构建返回的JSON对象
        const response = {
            char: char, // 也返回查询的字符
            spell: spellInfo[0], // 只取第一个元素，包含所有可能的音
            radicalCount: radicalInfo[0].radicalCount,
            radical: radicalInfo[0].radical,
            struct: radicalInfo[0].struct
        };

        console.log('Response:', response);

        res.json(response);
    } catch (error) {
        console.error('Error in /info/:char:', error);
        res.status(500).json({ error: 'An error occurred while processing your request', details: error.message });
    }
});


app.post('/generate-png', async (req, res) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).send('Text is required');
    }

    console.log(`Generating PNGs for text: ${text}`);

    // 使用 Puppeteer 启动无头浏览器
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
        const page = await browser.newPage();

    // 设置页面内容
    await page.setContent(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Draw</title>
        </head>
        <body>
            <div id="drawStroke"></div>
            <script src="https://unpkg.com/cnchar@latest"></script>
            <script src="https://unpkg.com/cnchar-draw@latest"></script>
        </body>
        </html>
    `);

    // 执行绘制代码
    await page.evaluate((text) => {
        cnchar.use(cncharDraw);
        cnchar.draw(text, {
            el: '#drawStroke',
            type: cnchar.draw.TYPE.STROKE
        });
    }, text);

    // 等待绘制完成并确保 SVG 可见，超时设置为 60 秒
    await page.waitForSelector('#drawStroke svg', { visible: true, timeout: 60000 });

    // 获取所有 SVG 元素并进行截图
    const svgs = await page.$$('#drawStroke svg');
    const result = [];

    // 确保 images 目录存在
    const imagesDir = path.join(__dirname, 'images');
    if (!fs.existsSync(imagesDir)) {
        console.log('Creating images directory');
        fs.mkdirSync(imagesDir);
    }

    // 为 text 创建一个子文件夹
    const textDir = path.join(imagesDir, text);
    if (!fs.existsSync(textDir)) {
        console.log(`Creating directory for text: ${text}`);
        fs.mkdirSync(textDir);
    }

    for (let i = 0; i < svgs.length; i++) {
        const pngFileName = `stroke_${i}.png`;
        const pngFilePath = path.join(textDir, pngFileName);

        // 对 SVG 元素进行截图并保存为 PNG 文件
        console.log(`Converting SVG to PNG: ${pngFilePath}`);
        await svgs[i].screenshot({ path: pngFilePath });

        // 返回 PNG 文件的 URL
        result.push({ pngUrl: `https://jinghuaiapi.fun/images/${text}/${pngFileName}` });
    }

    // 关闭浏览器
    await browser.close();

    console.log('PNG generation complete', result);
    res.json(result);
});


// 路由：生成包含四种字体的图像
app.post('/generate-font-image', (req, res) => {
    const { text } = req.body;

    if (!text || text.length !== 1) {
        console.log('Invalid text input');
        return res.status(400).send('Text is required and must be a single character');
    }

    console.log(`Generating font image for text: ${text}`);
    const pythonScriptPath = path.join(__dirname, 'generate_image.py');

    execFile('python', [pythonScriptPath, text], { encoding: 'utf8' }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Python script error: ${stderr}`);
            return res.status(500).send('Error generating image');
        }

        console.log(`Python script output: ${stdout}`);
        const outputFilePath = stdout.trim();
        const fileName = path.basename(outputFilePath);
        const imageUrl = `https://jinghuaiapi.fun/images/ancient_modern/${fileName}`;

        console.log(`Image generated: ${imageUrl}`);
        res.json({ imageUrl });
    });
});

// 静态文件服务，用于提供生成的图片
app.use('/images', express.static(path.join(__dirname, 'images')));

app.listen(port, () => {
    console.log(`Server running at https://jinghuaiapi.fun:${port}`);
});
