import sys
from PIL import Image, ImageDraw, ImageFont
import os
from pypinyin import lazy_pinyin

# 获取命令行参数
text = sys.argv[1]

# 将汉字转换为拼音，用作文件名
pinyin_name = ''.join(lazy_pinyin(text))

# 获取脚本的当前目录
current_dir = os.path.dirname(os.path.abspath(__file__))

# 构建字体文件的绝对路径
font_dir = os.path.join(current_dir, 'font')
font_path_1 = os.path.join(font_dir, 'guwens.ttf')
font_path_2 = os.path.join(font_dir, 'jinwen.ttf')
font_path_3 = os.path.join(font_dir, 'xiaozhuan.ttf')
font_path_4 = os.path.join(font_dir, 'kaishu.ttf')

# 加载字体
font_size_main = 65
font_size_label = 20
font_main_1 = ImageFont.truetype(font_path_1, font_size_main)
font_main_2 = ImageFont.truetype(font_path_2, font_size_main)
font_main_3 = ImageFont.truetype(font_path_3, font_size_main)
font_main_4 = ImageFont.truetype(font_path_4, font_size_main)
font_label = ImageFont.truetype(font_path_4, font_size_label)

# 计算图像尺寸
image_width = 4 * font_size_main + 3 * 50 + 2 * 60  # 4 字符, 3 个 50px 的间隔，和 60px 的边距
image_height = font_size_main + 60 * 2 + font_size_label  # 字符高度 + 上下边距 + 标签高度
image = Image.new('RGB', (image_width, image_height), 'white')
draw = ImageDraw.Draw(image)

# 文字内容
texts_main = [text] * 4
texts_label = ['甲骨文', '金文', '小篆', '楷书']
fonts_main = [font_main_1, font_main_2, font_main_3, font_main_4]
x_positions = [60 + i * (font_size_main + 50) for i in range(4)]

# 动态计算每个字的y坐标，使得不同字体的字能够对齐
y_positions_main = []
y_base_position = 60
for i, font in enumerate(fonts_main):
    bbox = draw.textbbox((0, 0), texts_main[i], font=font)
    text_height = bbox[3] - bbox[1]
    y_positions_main.append(y_base_position + (font_size_main - text_height) // 2)

y_position_label = y_base_position + font_size_main

# 绘制文字
for i in range(4):
    draw.text((x_positions[i], y_positions_main[i]), texts_main[i], fill='black', font=fonts_main[i])
    draw.text((x_positions[i], y_position_label), texts_label[i], fill='black', font=font_label)

# 在 images/ancient_modern 目录中保存图片
output_dir = os.path.join(current_dir, 'images', 'ancient_modern')
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# 保存图像，文件名为拼音.png
output_path = os.path.join(output_dir, f'{pinyin_name}.png')
image.save(output_path)

print(output_path)  # 输出图像的路径
