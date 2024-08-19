const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const bodyParser = require('body-parser');
const cnchar = require('cnchar');
const poly = require('cnchar-poly');
const order = require('cnchar-order');
require('jsdom-global')(); // 模拟浏览器环境

const { execFile } = require('child_process');


const app = express();
const port = 3000;

app.use(express.json());
app.use(bodyParser.json({ limit: '10mb' })); // 解析 JSON 请求体
cnchar.use(poly, order);


// 第一个代码片段：字符查询相关路由
async function getCharactersByMandarin(mandarin) {
    try {
        const response = await axios.get(`http://ccdb.hemiola.com/characters/mandarin/${mandarin}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching characters by mandarin:", error);
        throw error;
    }
}

async function getCharactersByStrokes(strokes) {
    try {
        const response = await axios.get(`http://ccdb.hemiola.com/characters/strokes/${strokes}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching characters by strokes:", error);
        throw error;
    }
}

async function getCharactersByRadical(radical) {
    try {
        const response = await axios.get(`http://ccdb.hemiola.com/characters/radicals/${radical}`);
        return response.data;
    } catch (error) {
        console.error("Error fetching characters by radical:", error);
        throw error;
    }
}

async function getCharactersByRadicalAndStrokes(rs) {
    try {
        const response = await axios.get(`http://ccdb.hemiola.com/characters/radicals/${rs.radical}?strokes=${rs.strokes}`);
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


// 第二个代码片段：生成PNG图片相关路由
app.post('/generate-png', async (req, res) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).send('Text is required');
    }

    document.body.innerHTML = '<div id="drawStroke"></div>';
    const draw = require('cnchar-draw');
    cnchar.use(draw);

    await new Promise((resolve) => {
        cnchar.draw(text, {
            el: '#drawStroke',
            type: cnchar.draw.TYPE.STROKE,
            onComplete: () => {
                resolve();
            },
        });
    });

    const svgs = [...document.querySelectorAll('svg')];
    const result = [];

    // 确保 images 目录存在
    const imagesDir = path.join(__dirname, 'images');
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir);
    }

    // 为 text 创建一个子文件夹
    const textDir = path.join(imagesDir, text);
    if (!fs.existsSync(textDir)) {
        fs.mkdirSync(textDir);
    }

    for (let i = 0; i < svgs.length; i++) {
        const svg = svgs[i];
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        const svgContent = svg.outerHTML;
        const pngFileName = `stroke_${i}.png`;
        const svgFilePath = path.join(textDir, `stroke_${i}.svg`);
        const pngFilePath = path.join(textDir, pngFileName);

        // 保存SVG文件
        fs.writeFileSync(svgFilePath, svgContent);

        // 使用 sharp 将 SVG 转换为 PNG 并保存
        await sharp(Buffer.from(svgContent))
            .png()
            .toFile(pngFilePath);

        // 删除原始 SVG 文件
        fs.unlinkSync(svgFilePath);

        // 返回PNG文件的URL
        result.push({ pngUrl: `http://localhost:${port}/images/${text}/${pngFileName}` });
    }

    res.json(result);
});


// 路由：生成包含四种字体的图像
app.post('/generate-font-image', (req, res) => {
    const { text } = req.body;

    if (!text || text.length !== 1) {
        return res.status(400).send('Text is required and must be a single character');
    }

    // 调用 Python 脚本生成图像
    const pythonScriptPath = path.join(__dirname, 'generate_image.py');
    execFile('python', [pythonScriptPath, text], (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${stderr}`);
            return res.status(500).send('Error generating image');
        }

        // 输出图像路径
        const outputFilePath = stdout.trim();
        res.sendFile(outputFilePath);
    });
});
// 静态文件服务，用于提供生成的图片
app.use('/images', express.static(path.join(__dirname, 'images')));

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
