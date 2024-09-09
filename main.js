// Класс для работы с WebGL

class WebGL {
    /**
     * @param {HTMLElement} canvasElement HTML элемент canvas
     * @param {number} canvasWidth Ширина создаваемого элемента canvas в пикселях
     * @param {number} canvasHeight Высота создаваемого элемента canvas в пикселях
     * @param {object} contextAttributes Атрибуты контекста WebGL
     */
    constructor(canvasElement, canvasWidth = window.innerWidth, canvasHeight = window.innerHeight, contextAttributes = { alpha: false }) {
        this.canvas = canvasElement || WebGLHelper.createCanvas(canvasWidth, canvasHeight);
        this.$ = this.canvas.getContext('webgl', contextAttributes);
    }

    /**
     * Создаёт новую шейдерную программу
     * @param {string} vertexShader Вершинный шейдер
     * @param {string} fragmentShader Фрагментный щейдер
     * @returns {object} Новая шейдерная программа
     */
    createShaderProgram(vertexShader, fragmentShader) {
        let program = this.$.createProgram(),
            createShader = (type, source) => {
                let shader = this.$.createShader(type);
                this.$.shaderSource(shader, source);
                this.$.compileShader(shader);
                return shader;
            };
        this.$.attachShader(program, createShader(this.$.VERTEX_SHADER, vertexShader));
        this.$.attachShader(program, createShader(this.$.FRAGMENT_SHADER, fragmentShader));
        this.$.linkProgram(program);
        this.$.useProgram(program);
        return program;
    }

    /**
     * Создаёт буфер и хранилище данных буферного объекта
     * @param {Array} geometryData Массив типизированных массивов с информацией о координатах вершин, индексов, нормалей и т.д.
     * @param {boolean} createBuffer Указывает, необходимо ли создавать и привязывать новый буфер
     */
    initializeBuffer(geometryData, createBuffer) {
        for (let data of geometryData) {
            let targetType;
            if (data instanceof Float32Array)
                targetType = this.$.ARRAY_BUFFER;
            else if (data instanceof Uint8Array || data instanceof Uint16Array)
                targetType = this.$.ELEMENT_ARRAY_BUFFER;
            else throw new TypeError('Unsupported typed array type');
            if (createBuffer === true) {
                this.$.bindBuffer(targetType, this.$.createBuffer());
                this.$.bufferData(targetType, data, this.$.STATIC_DRAW);
            } else this.$.bufferData(targetType, data, this.$.STATIC_DRAW);
        }
    }

    /**
     * Устанавливает и активирует атрибут
     * @param {object} program Шейдерная программа
     * @param {Array} geometryData Массив типизированных массивов с информацией о координатах вершин, индексов, нормалей и т.д.
     * @param {Array} attributes Объект с информацией об атрибутах. Имена свойств объекта должны совпадать с именами атрибутов
     */
    setAttribute(program, geometryData, attributes) {
        let stride = geometryData[0].BYTES_PER_ELEMENT * Object.values(attributes).reduce((a, b) => a + b);
        for (let attribute in attributes) {
            let location = this.$.getAttribLocation(program, attribute),
                offset = 0;
            if (attribute == 'a_TextureCoords')
                offset = geometryData[0].BYTES_PER_ELEMENT * attributes['a_Position'];
            this.$.vertexAttribPointer(location, attributes[attribute], this.$.FLOAT, false, stride, offset);
            this.$.enableVertexAttribArray(location);
        }
    }

    /**
     * Задаёт значение uniform-переменной
     * @param {object} program Шейдерная программа
     * @param {Array} variables Объект с информацией о uniform-переменных. Имена свойств объекта должны совпадать с именами uniform-переменных. 
     * В качестве значения ипользуется объект со свойствоми "type" и "value" для указания типа данных и значения
     */
    setUniformValue(program, variables) {
        for (let variable in variables) {
            let location = this.$.getUniformLocation(program, variable);
            switch (variables[variable].type) {
                case 'bool':
                case 'int':
                    this.$.uniform1i(location, variables[variable].value);
                    break;
                case 'float':
                    this.$.uniform1f(location, variables[variable].value);
                    break;
                case 'vec2':
                    this.$.uniform2fv(location, variables[variable].value);
                    break;
                case 'vec3':
                    this.$.uniform3fv(location, variables[variable].value);
                    break;
                case 'vec4':
                    this.$.uniform4fv(location, variables[variable].value);
                    break;
                case 'mat4':
                    this.$.uniformMatrix4fv(location, false, variables[variable].value);
            }
        }
    }

    /**
     * Создает и настраивает объект текстуры
     * @param {object} source Источник изображения. Может быть DOM элементом, элементов canvas, объектом типа Uint8Array и т.д.
     * @returns {object} Новый объект текстуры
     */
    createAndSetupTexture(source) {
        let texture = this.$.createTexture();
        this.$.bindTexture(this.$.TEXTURE_2D, texture);
        if (source instanceof Uint8Array) {
            this.$.texImage2D(this.$.TEXTURE_2D, 0, this.$.RGBA, 1, 1, 0, this.$.RGBA, this.$.UNSIGNED_BYTE, source);
        } else if (source instanceof ImageBitmap || source instanceof Object) {
            if (!WebGLHelper.isDedgeeTwo(source.width || source.clientWidth) && !WebGLHelper.isDedgeeTwo(source.height || source.clientHeight)) {
                this.$.texParameteri(this.$.TEXTURE_2D, this.$.TEXTURE_WRAP_S, this.$.CLAMP_TO_EDGE);
                this.$.texParameteri(this.$.TEXTURE_2D, this.$.TEXTURE_WRAP_T, this.$.CLAMP_TO_EDGE);
            }
            this.$.pixelStorei(this.$.UNPACK_FLIP_Y_WEBGL, true);
            this.$.texParameteri(this.$.TEXTURE_2D, this.$.TEXTURE_MIN_FILTER, this.$.LINEAR);
            this.$.texImage2D(this.$.TEXTURE_2D, 0, this.$.RGBA, this.$.RGBA, this.$.UNSIGNED_BYTE, source);
        } else throw new TypeError('Unsupported texture source type');
        return texture;
    }

    /**
     * Обновляет объект текстуры, присваивая новое изображение
     * @param {object} texture Существующий объект, который необходимо обновить
     * @param {object} source Источник изображения. Может быть DOM элементом, элементов canvas, объектом типа Uint8Array и т.д.
     */
    updateTexture(texture, source) {
        this.$.bindTexture(this.$.TEXTURE_2D, texture);
        if (source instanceof Uint8Array)
            this.$.texImage2D(this.$.TEXTURE_2D, 0, this.$.RGBA, 1, 1, 0, this.$.RGBA, this.$.UNSIGNED_BYTE, source);
        else if (source instanceof ImageBitmap || source instanceof Object)
            this.$.texImage2D(this.$.TEXTURE_2D, 0, this.$.RGBA, this.$.RGBA, this.$.UNSIGNED_BYTE, source);
        else throw new TypeError('Unsupported texture source type');
    }

    /**
     * Устанавливает и активирует текстурный слот
     * @param {object} program Шейдерная программа
     * @param {Array} uniformData Массив с информацией о uniform-переменных
     * @param {object} texture Объетк текстуры
     */
    defineTextureSlot(program, uniformData, texture) {
        this.$.bindTexture(this.$.TEXTURE_2D, texture);
        this.$.activeTexture(this.$.TEXTURE0 + Object.values(uniformData)[0].value);
        this.setUniformValue(program, uniformData);
    }

    /**
     * Подготавливает область для рисования объектов
     * @param {object} clearColor Объект с информацией о цвете в формате RGBA
     * @param {boolean} setViewport Указывает, необходимо ли установить размеры области просмотра
     */
    prepareCanvas(clearColor, setViewport) {
        if (clearColor) {
            for (let color in clearColor)
                if (clearColor[color] < 0 || clearColor[color] > 255)
                    throw new Error('Сolor value is incorrect');
            this.$.clearColor(1 / 255 * clearColor.r, 1 / 255 * clearColor.g, 1 / 255 * clearColor.b, clearColor.a);
        }
        if (setViewport)
            this.$.viewport(0, 0, this.canvas.width, this.canvas.height)
        this.$.clear(this.$.COLOR_BUFFER_BIT);
    }

    /**
     * Отрисовывает кадр на экране
     * @param {object} program Шейдерная программа
     * @param {Array} geometryData Массив типизированных массивов с информацией о координатах вершин, индексов, нормалей и т.д.
     * @param {Array} uniformData Массив с информацией о uniform-переменных
     * @param {object} texture Объетк текстуры
     */
    drawFrame(program, geometryData, uniformData, texture) {
        let geometry = geometryData[1] ?? geometryData[0];
        this.setUniformValue(program, uniformData);
        if (texture)
            this.$.bindTexture(this.$.TEXTURE_2D, texture);
        if (geometry instanceof Float32Array)
            this.$.drawArrays(this.$.TRIANGLES, 0, geometry.length / geometry.size);
        else if (geometry instanceof Uint8Array || geometry instanceof Uint16Array)
            this.$.drawElements(this.$.TRIANGLES, geometry.length, this.$.UNSIGNED_SHORT, 0);
        else throw new TypeError('Unsupported typed array type');
    }
}

// Класс для создания геометрии
class WebGLGeometry {
    /**
     * Создаёт плоскость заданной ширины, высоты и количества сегментов
     * @param {number} widthInPx Ширина плоскости в пикселях
     * @param {number} heightInPx Высота плоскости в пикселях
     * @param {number} segmentsByWidth Количество сегментов по ширине
     * @param {number} segmentsByHeight Количество сегментов по высоте
     * @param {boolean} useTexture Указывает, необходимо ли добавить информацию о текстурных координатах
     * @param {boolean} onTop Указывает на положение геометрии относительно верхнего края холста.
     * Значение "true" указывает, что будет применено выравнивание по верхнему краю, иначе будет применено выравнивание по центру.
     * @param {boolean} onLeft Указывает на положение геометрии относительно левого края холста.
     * Значение "true" указывает, что будет применено выравнивание по левому краю, иначе будет применено выравнивание по центру.
     * @returns {Array} Массив типизированных массивов с информацией о координатах вершин, индексов, нормалей и т.д.
     */
    static createPlane(canvas, widthInPx, heightInPx, segmentsByWidth, segmentsByHeight, useTexture, onTop, onLeft) {
        let [width, height] = WebGLHelper.convertCoords(canvas, widthInPx, heightInPx),
            [canvasWidth, canvasHeight] = WebGLHelper.convertCoords(canvas, canvas.clientWidth, canvas.clientHeight),
            topOffset = onTop ? height - canvasHeight / 2 : height / 2,
            leftOffset = onLeft ? canvasWidth / 2 : width / 2,
            coords = [],
            indexes = [],
            xAxisVerteces, yAxisVerteces, xAxisTextureStep, yAxisTextureStep;
        segmentsByWidth = segmentsByWidth < 1 ? 1 : segmentsByWidth;
        segmentsByHeight = segmentsByHeight < 1 ? 1 : segmentsByHeight;
        xAxisVerteces = segmentsByWidth + 1;
        yAxisVerteces = segmentsByHeight + 1;
        if (useTexture) {
            xAxisTextureStep = 1 / segmentsByWidth;
            yAxisTextureStep = 1 / segmentsByHeight;
        }
        for (let yAxisStep = 0; yAxisStep < yAxisVerteces; yAxisStep++)
            for (let xAxisStep = 0; xAxisStep < xAxisVerteces; xAxisStep++) {
                coords.push(width / segmentsByWidth * xAxisStep - leftOffset, height / segmentsByHeight * yAxisStep - topOffset);
                if (useTexture)
                    coords.push(xAxisTextureStep * xAxisStep, yAxisTextureStep * yAxisStep);
                if (xAxisStep < segmentsByWidth && yAxisStep < segmentsByHeight) {
                    let i1 = xAxisStep + xAxisVerteces * yAxisStep,
                        i2 = xAxisStep + xAxisVerteces * (yAxisStep + 1),
                        i3 = (xAxisStep + 1) + xAxisVerteces * (yAxisStep + 1),
                        i4 = (xAxisStep + 1) + xAxisVerteces * yAxisStep;
                    indexes.push(i1, i2, i4, i2, i3, i4);
                }
            }
        return [new Float32Array(coords), new Uint16Array(indexes)];
    }
}

// Вспомогательный класс
class WebGLHelper {
    /**
     * Создаёт canvas и добавляет его на HTML страницу
     * @param {number} width Ширина создаваемого элемента canvas в пикселях
     * @param {number} height Высота создаваемого элемента canvas в пикселях
     * @returns {HTMLElement} Новый элемент canvas
     */
    static createCanvas(width, height) {
        let canvas = document.createElement('canvas');
        canvas.id = 'canvas_webgl';
        canvas.setAttribute('width', width);
        canvas.setAttribute('height', height);
        return canvas;
    }

    /**
     * Проверяет, является ли аргумент степенью числа 2
     * @param {number} value Проверяемое значение
     * @returns {boolean}
     */
    static isDedgeeTwo(value) {
        return (value & (value - 1)) === 0;
    }

    /**
     * Преобразует пиксельные координаты в координаты пространства WebGL 
     * @param {object} canvas Элемент canvas, для определения его ширины и высоты в пикселях
     * @param {number} xAxisCoordsInPx Координата по оси x (по ширине) в пикселях
     * @param {number} yAxisCoordsInPx Координата по оси y (по высоте) в пикселях
     * @returns {object} Объект, с указанными именами свойств, содержащий информацию о координатах
     */
    static convertCoords(canvas, xAxisCoordsInPx, yAxisCoordsInPx) {
        return [
            xAxisCoordsInPx / ((canvas ? canvas.width : window.innerWidth) / 2),
            yAxisCoordsInPx / ((canvas ? canvas.height : window.innerHeight) / 2)
        ]
    }
}
