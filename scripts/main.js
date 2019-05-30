"use strict";

Math.clamp = function(number, min, max) {
    return Math.min(Math.max(number, min), max);
  };

const vec3_zero = vec3.create();

var gl;

var settings = {
    uniform:
    {
        matrices:{},
        cam_info:
        {
            //position
            buffer: new Float32Array([0., 0., 1.5])
        },
        material:
        {
            buffer: new Float32Array([1., 1., 1., 1., 256])
        },
        ambient_light:
        {
            buffer: new Float32Array([0.1,0.1,0.1])
        },
        point_light:
        {
            buffer: new Float32Array([0.0, 0.0, 4, 24., 1.0, 1.0, 1.0])
        },
        point_lightV:{},
        settings:
        {
            buffer: new Int32Array([1,1,1,1])
        }
    },
    tex:
    {
        diffuse:{slot:0},
        normal:{slot:1},
        specular:{slot:2},
        emissive:{slot:3}
    },
    mat:{},
    cam: vec3.fromValues(0., 0., 1.5),
    keys:{},
    x:0,
    y:0
}

var rot_speed = 0.5;
var counter;
var last_time;
var delta_time;
var tilt;

function Float32Concat(first, second)
{
    let first_length = first.length,
        result = new Float32Array(first_length + second.length);
    result.set(first);
    result.set(second, first_length);
    return result;
}

function makeSampler() {
    var linear_sampler = gl.createSampler();
    gl.samplerParameteri(linear_sampler, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.samplerParameteri(linear_sampler, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.samplerParameteri(linear_sampler, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.samplerParameteri(linear_sampler, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.samplerParameteri(linear_sampler, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return linear_sampler;
}

function prepareTexture(kind)
    {
        settings.tex[kind].sampler = makeSampler();
        settings.tex[kind].src  = document.getElementById(kind);
        settings.tex[kind].id = gl.createTexture();
        loadTexture(settings.tex[kind].id, settings.tex[kind].src);
    }

function loadTexture(textureID, texture) {
    gl.bindTexture(gl.TEXTURE_2D, textureID);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
}

function bindUniformBufferData(ubo, buffer) {
    gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
    gl.bufferData(gl.UNIFORM_BUFFER, buffer, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
}

function SubUniformBuffer(ubo, buffer) {
    gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, buffer, 0, 0);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
}

function resetTexture(kind)
{
    let texInput = document.getElementById(kind+"Input");
    return function(event)
    {
        texInput.value = null;
        settings.tex[kind].customSRC.src = ""
        gl.activeTexture(gl.TEXTURE0 + settings.tex[kind].slot);
        gl.bindTexture(gl.TEXTURE_2D, settings.tex[kind].id);
    }
}

function updateSettings(id)
{
    return function(event)
    {
        if(this.checked)
            settings.uniform.settings.buffer.set([1],id);
        else
            settings.uniform.settings.buffer.set([0],id);
        SubUniformBuffer(settings.uniform.settings.ubo, settings.uniform.settings.buffer);
    };
};

function uploadTexture(kind)
{
    settings.tex[kind].customSRC = document.getElementById(kind+"Img")
    settings.tex[kind].customSRC.onload = function()
    {
        gl.deleteTexture(settings.tex[kind].customID);
        settings.tex[kind].customID = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + settings.tex[kind].slot);
        loadTexture(settings.tex[kind].customID, settings.tex[kind].customSRC);
        gl.bindTexture(gl.TEXTURE_2D, settings.tex[kind].customID);
    }
    return function(event)
    {
        let reader = new FileReader();
        reader.onload = function()
        {
            settings.tex[kind].customSRC.src = reader.result;
        }
        reader.readAsDataURL(this.files[0]);
    };
};

function RGBStringToVec(rgb)
{
    return rgb.match(/[A-Za-z0-9]{2}/g).map(function(v) { return (parseInt(v, 16)/256) });
}

function init()
{
    counter = Number(0.0);
    last_time = Number(0.0);
    delta_time = Number(0.0);
    tilt = Number(0.0);
    // inicjalizacja webg2
    try {
        let canvas = document.querySelector("#glcanvas");
        gl = canvas.getContext("webgl2");
    }
    catch(e) {
    }

    if (!gl)
    {
        alert("Unable to initialize WebGL.");
        return;
    }

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    gl.clearColor(0.2, 0.2, 0.2, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);    

    // kompilacja shader-ow
    var vertex_shader = createShader(gl, gl.VERTEX_SHADER, vs_source);
    var fragment_shader = createShader(gl, gl.FRAGMENT_SHADER, fs_source);
    var program = createProgram(gl, vertex_shader, fragment_shader);

    // pobranie ubi
    settings.uniform.matrices.ubi = gl.getUniformBlockIndex(program, "Matrices");
    settings.uniform.cam_info.ubi = gl.getUniformBlockIndex(program, "CamInfo");
    settings.uniform.material.ubi = gl.getUniformBlockIndex(program, "Material");
    settings.uniform.point_light.ubi = gl.getUniformBlockIndex(program, "PointLight");
    settings.uniform.ambient_light.ubi = gl.getUniformBlockIndex(program, "Ambient");
    settings.uniform.point_lightV.ubi = gl.getUniformBlockIndex(program, "PointLightV");
    settings.uniform.settings.ubi = gl.getUniformBlockIndex(program, "Settings");

    // przyporzadkowanie ubi do ubb
    settings.uniform.matrices.ubb = 0;
    settings.uniform.cam_info.ubb = 1;
    settings.uniform.material.ubb = 2;
    settings.uniform.point_light.ubb = 3;
    settings.uniform.point_lightV.ubb = 4;
    settings.uniform.ambient_light.ubb = 5;
    settings.uniform.settings.ubb = 6;

    for(let name in settings.uniform)
    {
        let uni = settings.uniform[name];
        gl.uniformBlockBinding(program, uni.ubi, uni.ubb);
    }
    
    for(let name in settings.tex)
    {
        prepareTexture(name);
    }

    let Pyramid = new Hexahedron([
        [-0.5, -0.2,  0.5],
        [ 0.5, -0.2,  0.5],
        [ 0.5, -0.2, -0.5],
        [-0.5, -0.2, -0.5],
        [-0.25,  0.4,  0.25],
        [ 0.25,  0.4,  0.25],
        [ 0.25,  0.4, -0.25],
        [-0.25,  0.4, -0.25]
    ]);

    Pyramid.setFaceTex(0,[0,1],[1,1],[1,0],[0,0]);
    Pyramid.setFaceTex(1,[0,1],[1,1],[1,0],[0,0]);
    Pyramid.setFaceTex(2,[0,1],[1,1],[0.75,0],[0.25,0]);
    Pyramid.setFaceTex(3,[0,1],[1,1],[0.75,0],[0.25,0]);
    Pyramid.setFaceTex(4,[0,1],[1,1],[0.75,0],[0.25,0]);
    Pyramid.setFaceTex(5,[0,1],[1,1],[0.75,0],[0.25,0]);

    settings.model = new Model(Pyramid.VertexBuffer, Pyramid.IndexBuffer, Pyramid.Attributes);
    
    // dane o macierzy
    var mvp_matrix = mat4.create();
    settings.mat.M = mat4.create();
    settings.mat.V = mat4.create();
    settings.mat.P = mat4.create();
    mat4.lookAt(settings.mat.V, settings.uniform.cam_info.buffer, new Float32Array([0., 0., 0.]), new Float32Array([0., 1., 0.]));
    mat4.perspective(settings.mat.P, Math.PI/4., gl.drawingBufferWidth/gl.drawingBufferHeight, 0.01, 10);
    mat4.multiply(mvp_matrix, settings.mat.P, settings.mat.V);
    mat4.multiply(mvp_matrix, mvp_matrix, settings.mat.M);

    settings.uniform.matrices.ubo = gl.createBuffer();
    bindUniformBufferData(settings.uniform.matrices.ubo, Float32Concat(mvp_matrix, settings.mat.M));

    settings.uniform.cam_info.ubo = gl.createBuffer();
    bindUniformBufferData(settings.uniform.cam_info.ubo, settings.uniform.cam_info.buffer);

    settings.uniform.material.ubo = gl.createBuffer();
    bindUniformBufferData(settings.uniform.material.ubo, settings.uniform.material.buffer);

    settings.uniform.point_light.ubo = gl.createBuffer();
    settings.uniform.point_lightV.ubo = settings.uniform.point_light.ubo;
    bindUniformBufferData(settings.uniform.point_light.ubo, settings.uniform.point_light.buffer);

    settings.uniform.ambient_light.ubo = gl.createBuffer();
    bindUniformBufferData(settings.uniform.ambient_light.ubo, settings.uniform.ambient_light.buffer);

    settings.uniform.settings.ubo = gl.createBuffer();
    bindUniformBufferData(settings.uniform.settings.ubo, settings.uniform.settings.buffer);

    // ustawienia danych dla funkcji draw*
    gl.useProgram(program);

    for(let name in settings.tex)
    {
        gl.bindSampler(settings.tex[name].slot, settings.tex[name].sampler);
        gl.activeTexture(gl.TEXTURE0 + settings.tex[name].slot);
        gl.bindTexture(gl.TEXTURE_2D, settings.tex[name].id);
    }

    gl.uniform1i(gl.getUniformLocation(program,"color_tex"), 0);
    gl.uniform1i(gl.getUniformLocation(program,"normal_tex"), 1);
    gl.uniform1i(gl.getUniformLocation(program,"specular_tex"), 2);
    gl.uniform1i(gl.getUniformLocation(program,"emissive_tex"), 3);

    for(let name in settings.uniform)
    {
        let uni = settings.uniform[name];
        gl.bindBufferBase(gl.UNIFORM_BUFFER, uni.ubb, uni.ubo);
    }

    document.getElementById("useDiffuse").addEventListener("change", updateSettings(0));
    document.getElementById("useNormal").addEventListener("change", updateSettings(1));
    document.getElementById("useSpecular").addEventListener("change", updateSettings(2));
    document.getElementById("useEmissive").addEventListener("change", updateSettings(3));

    document.getElementById("matColor").addEventListener("change", function(event)
    {
        let newColor = RGBStringToVec(this.value);
        settings.uniform.material.buffer.set(newColor, 0);
        SubUniformBuffer(settings.uniform.material.ubo, settings.uniform.material.buffer);
    });

    document.getElementById("lightColor").addEventListener("change", function(event)
    {
        let newColor = RGBStringToVec(this.value);
        settings.uniform.point_light.buffer.set(newColor, 4);
        SubUniformBuffer(settings.uniform.point_light.ubo, settings.uniform.point_light.buffer);
    });

    document.getElementById("ambientColor").addEventListener("change", function(event)
    {
        let newColor = RGBStringToVec(this.value);
        settings.uniform.ambient_light.buffer.set(newColor, 0);
        gl.clearColor(...newColor, 1.0);
        SubUniformBuffer(settings.uniform.ambient_light.ubo, settings.uniform.ambient_light.buffer);
    });

    document.getElementById("specularIntensity").addEventListener("change", function(event)
    {
        settings.uniform.material.buffer.set([this.value], 3);
        SubUniformBuffer(settings.uniform.material.ubo, settings.uniform.material.buffer);
    });

    document.getElementById("diffuseInput").addEventListener("change", uploadTexture("diffuse"));
    document.getElementById("normalInput").addEventListener("change", uploadTexture("normal"));
    document.getElementById("specularInput").addEventListener("change", uploadTexture("specular"));
    document.getElementById("emissiveInput").addEventListener("change", uploadTexture("emissive"));

    document.getElementById("resetDiffuse").addEventListener("click", resetTexture("diffuse"));
    document.getElementById("resetNormal").addEventListener("click", resetTexture("normal"));
    document.getElementById("resetSpecular").addEventListener("click", resetTexture("specular"));
    document.getElementById("resetEmissive").addEventListener("click", resetTexture("emissive"));

    document.getElementById("radiansPerSecond").addEventListener("change", function(event)
    {
        rot_speed = this.value;
    });
    document.getElementById("tilt").addEventListener("change", function(event)
    {
        tilt =  Math.PI*this.value/180;
    });

    window.addEventListener("keydown", function(event)
    {
        settings.keys[event.keyCode] = true;
    });
    window.addEventListener("keyup", function(event)
    {
        settings.keys[event.keyCode] = false;
    });
}

const yLimit = Math.PI * 0.5 * 0.9999

function updateCameraPosition()
{
    let x = 0;
    let y = 0;
    if(settings.keys[65])
        x -= 1;
    if(settings.keys[68])
        x += 1;
    if(settings.keys[83])
        y += 1;
    if(settings.keys[87])
        y -= 1;

    settings.x += delta_time*x;
    settings.y += delta_time*y;

    settings.y = Math.clamp(settings.y, -yLimit, yLimit);
    
    let newCam = vec3.create();
    vec3.rotateX(newCam, settings.cam, vec3_zero, settings.y)
    vec3.rotateY(newCam, newCam, vec3_zero, settings.x)

    settings.uniform.cam_info.buffer.set(newCam, 0);
    SubUniformBuffer(settings.uniform.cam_info.ubo, settings.uniform.cam_info.buffer);
}

function draw(timestamp)
{
    timestamp = timestamp || 0.0;
    delta_time = ((timestamp - last_time)/1000.0);
    last_time = timestamp;
    // wyczyszczenie ekranu
    gl.clear(gl.COLOR_BUFFER_BIT);

    counter += (rot_speed * delta_time);
    
    updateCameraPosition();

    let mvp_matrix = mat4.create();
    settings.mat.M = mat4.create();
    mat4.rotateY(settings.mat.M, settings.mat.M, counter);
    mat4.rotateZ(settings.mat.M, settings.mat.M, tilt);
    mat4.lookAt(settings.mat.V, settings.uniform.cam_info.buffer, new Float32Array([0., 0., 0.]), new Float32Array([0., 1., 0.]));
    mat4.multiply(mvp_matrix, settings.mat.P, settings.mat.V);
    mat4.multiply(mvp_matrix, mvp_matrix, settings.mat.M);    

    gl.bindBuffer(gl.UNIFORM_BUFFER, settings.uniform.matrices.ubo);
    gl.bufferSubData(gl.UNIFORM_BUFFER,0,Float32Concat(mvp_matrix, settings.mat.M),0,0);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);

    // wyslanie polecania rysowania do GPU (odpalenie shader-ow)
    drawModel(settings.model);

    window.requestAnimationFrame(draw);
}

function main()
{
    init();
    draw();
}

function createShader(gl, type, source)
{
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if(success)
    {
        return shader;
    }

    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
}

function createProgram(gl, vertex_shader, fragment_shader)
{
    var program = gl.createProgram();
    gl.attachShader(program, vertex_shader);
    gl.attachShader(program, fragment_shader);
    gl.linkProgram(program);
    var success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if(success)
    {
        return program;
    }

    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}

// vertex shader (GLSL)
var vs_source = `#version 300 es
    layout(location = 0) in vec3 vertex_position;
    layout(location = 1) in vec3 vertex_normal;
    layout(location = 2) in vec3 vertex_tangent;
    layout(location = 3) in vec3 vertex_bitangent;
    layout(location = 4) in vec2 vertex_tex_coord;

    out vec3 position_ws;
    out vec2 tex_coord;
    out vec3 vV;
    out vec3 vL;

    layout(std140) uniform CamInfo
    {
       vec3 cam_pos_ws;
    } additional_data;

    layout(std140) uniform Matrices
    {
        mat4 mvp_matrix;
        mat4 model_matrix;
    } matrices;
    
    layout(std140) uniform PointLightV
    {
       vec3 position_ws;
    } point_light;

    void main()
    {
        gl_Position = matrices.mvp_matrix*vec4(vertex_position, 1.f);
        vec4 tmp_position_ws = matrices.model_matrix*vec4(vertex_position, 1.f);
        position_ws = tmp_position_ws.xyz/tmp_position_ws.w;

        mat3x3 nM = mat3x3(matrices.model_matrix);

        vec3 normal_ws = nM*vertex_normal;
        vec3 tangent_ws = nM*vertex_tangent;
        vec3 bitangent_ws = nM*vertex_bitangent;

        mat3 TBN = transpose(mat3(tangent_ws,bitangent_ws,normal_ws));

        vV = normalize(TBN*(additional_data.cam_pos_ws - position_ws));
        vL = normalize(TBN*(point_light.position_ws - position_ws));

        tex_coord = vertex_tex_coord;
    }`;

// fragment shader (GLSL)

var fs_source = `#version 300 es
    precision mediump float;
    precision lowp int;

    in vec3 position_ws;
    in vec3 vV;
    in vec3 vL;
    in vec2 tex_coord;
    out vec4 vFragColor;

    uniform sampler2D color_tex;
    uniform sampler2D normal_tex;
    uniform sampler2D specular_tex;
    uniform sampler2D emissive_tex;

    layout(std140) uniform Settings
    {
        int use_diffuse;
        int use_normal;
        int use_specular;
        int use_emissive;
    } settings;

    layout(std140) uniform Material
    {
       vec3 color;
       float specular_intensity;
       float specular_power;
    } material;

    layout(std140) uniform PointLight
    {
       vec3 position_ws;
       float r;
       vec3 color;
    } point_light;

    layout(std140) uniform Ambient
    {
        vec3 color;
    } ambient_light;

    vec4 getEmissive()
    {
        switch(settings.use_emissive)
        {
            default:
            case 0:
            {
                return vec4(0.0);
            }
            case 1:
            {
                return texture(emissive_tex, tex_coord);
            }
        }
    }

    vec4 getSpecular()
    {
        switch(settings.use_specular)
        {
            default:
            case 0:
            {
                return vec4(material.specular_intensity);
            }
            case 1:
            {
                return texture(specular_tex, tex_coord);
            }
        }
    }

    vec4 getNormal()
    {
        switch(settings.use_normal)
        {
            default:
            case 0:
            {
                return vec4(0.0,0.0,1.0,0.0);
            }
            case 1:
            {
                return texture(normal_tex, tex_coord)*2.0-1.0;
            }
        }
    }
    
    vec4 getDiffuse()
    {
        switch(settings.use_diffuse)
        {
            default:
            case 0:
            {
                return vec4(vec3(material.color),1.0);
            }
            case 1:
            {
                return texture(color_tex, tex_coord);
            }
        }
    }

    void main()
    {
        vec3 dist = point_light.position_ws-position_ws;
        vec3 L = normalize(vL);
        vec3 V = normalize(vV);
        vec3 N = normalize(getNormal().xyz);
        vec3 H = normalize(L+V);
        float attenuation = 1.0/ (1.0 + (dist.x*dist.x+dist.y*dist.y+dist.z*dist.z)*0.04);
        attenuation *= 1.0 - step(point_light.r,length(dist));
        vec4 tex_color = getDiffuse();
        vec3 diffuse = material.color*point_light.color*max(dot(N,L),0.0);
        diffuse *= attenuation;
        vec3 specular = pow(max(dot(H,N),0.0),material.specular_power)*point_light.color;
        specular *= attenuation;
        specular *= getSpecular().xyz;
        vec3 emissive = (tex_color*getEmissive()).xyz;
        vFragColor = vec4(clamp(tex_color.rgb*(ambient_light.color*material.color+diffuse)+specular+emissive,0.f,1.f),1.0);
    }`;
