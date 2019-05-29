"use strict";

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
    mat:
    {

    }
}

const rot_speed = 0.3;
var counter;
var last_time;
var delta_time;

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

function init()
{
    counter = Number(0.0);
    last_time = Number(0.0);
    delta_time = Number(0.0);
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
    
    settings.tex.diffuse.sampler = makeSampler();
    settings.tex.normal.sampler = makeSampler();
    settings.tex.specular.sampler = makeSampler();
    settings.tex.emissive.sampler = makeSampler();
    
    settings.tex.diffuse.src = document.querySelector("#diffuse");
    settings.tex.normal.src = document.querySelector("#normal");
    settings.tex.specular.src = document.querySelector("#specular");
    settings.tex.emissive.src = document.querySelector("#emissive");

    settings.tex.diffuse.id = gl.createTexture();
    loadTexture(settings.tex.diffuse.id, settings.tex.diffuse.src);

    settings.tex.normal.id = gl.createTexture();
    loadTexture(settings.tex.normal.id, settings.tex.normal.src);

    settings.tex.specular.id = gl.createTexture();
    loadTexture(settings.tex.specular.id, settings.tex.specular.src);

    settings.tex.emissive.id = gl.createTexture();
    loadTexture(settings.tex.emissive.id, settings.tex.emissive.src);

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

    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, Pyramid.VertexBuffer, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    var index_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, Pyramid.IndexBuffer, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    let gpu_positions_attrib_location = 0; // musi być taka sama jak po stronie GPU!!!
    let gpu_normals_attrib_location = 1;
    let gpu_tangents_attrib_location = 2;
    let gpu_bitangets_attrib_location = 3;
    let gpu_tex_coord_attrib_location = 4;

    // tworzenie VAO
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
    gl.enableVertexAttribArray(gpu_positions_attrib_location);
    gl.vertexAttribPointer(gpu_positions_attrib_location, 3, gl.FLOAT, gl.FALSE, 14*4, 0);
    gl.enableVertexAttribArray(gpu_normals_attrib_location);
    gl.vertexAttribPointer(gpu_normals_attrib_location, 3, gl.FLOAT, gl.FALSE, 14*4, 3*4);
    gl.enableVertexAttribArray(gpu_tangents_attrib_location);
    gl.vertexAttribPointer(gpu_tangents_attrib_location, 3, gl.FLOAT, gl.FALSE, 14*4, 6*4);
    gl.enableVertexAttribArray(gpu_bitangets_attrib_location);
    gl.vertexAttribPointer(gpu_bitangets_attrib_location, 3, gl.FLOAT, gl.FALSE, 14*4, 9*4);
    gl.enableVertexAttribArray(gpu_tex_coord_attrib_location);
    gl.vertexAttribPointer(gpu_tex_coord_attrib_location, 2, gl.FLOAT, gl.FALSE, 14*4, 12*4);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

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
    gl.bindSampler(0, settings.tex.diffuse.sampler);
    gl.activeTexture(gl.TEXTURE0 +  0);
    gl.bindTexture(gl.TEXTURE_2D, settings.tex.diffuse.id);
    gl.bindSampler(1, settings.tex.normal.sampler);
    gl.activeTexture(gl.TEXTURE0 +  1);
    gl.bindTexture(gl.TEXTURE_2D, settings.tex.normal.id);
    gl.bindSampler(2, settings.tex.specular.sampler);
    gl.activeTexture(gl.TEXTURE0 +  2);
    gl.bindTexture(gl.TEXTURE_2D, settings.tex.specular.id);
    gl.bindSampler(3, settings.tex.emissive.sampler);
    gl.activeTexture(gl.TEXTURE0 +  3);
    gl.bindTexture(gl.TEXTURE_2D, settings.tex.emissive.id);

    gl.uniform1i(gl.getUniformLocation(program,"color_tex"), 0);
    gl.uniform1i(gl.getUniformLocation(program,"normal_tex"), 1);
    gl.uniform1i(gl.getUniformLocation(program,"specular_tex"), 2);
    gl.uniform1i(gl.getUniformLocation(program,"emissive_tex"), 3);

    gl.bindVertexArray(vao);
    for(let name in settings.uniform)
    {
        let uni = settings.uniform[name];
        gl.bindBufferBase(gl.UNIFORM_BUFFER, uni.ubb, uni.ubo);
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

    document.getElementById("useDiffuse").addEventListener("change", updateSettings(0));
    document.getElementById("useNormal").addEventListener("change", updateSettings(1));
    document.getElementById("useSpecular").addEventListener("change", updateSettings(2));
    document.getElementById("useEmissive").addEventListener("change", updateSettings(3));

    document.getElementById("matColor").addEventListener("change", function(event)
    {
        let newColor = this.value.match(/[A-Za-z0-9]{2}/g).map(function(v) { return (parseInt(v, 16)/256) })
        settings.uniform.material.buffer.set(newColor, 0);
        SubUniformBuffer(settings.uniform.material.ubo, settings.uniform.material.buffer);
    });

    document.getElementById("lightColor").addEventListener("change", function(event)
    {
        let newColor = this.value.match(/[A-Za-z0-9]{2}/g).map(function(v) { return (parseInt(v, 16)/256) })
        settings.uniform.point_light.buffer.set(newColor, 4);
        SubUniformBuffer(settings.uniform.point_light.ubo, settings.uniform.point_light.buffer);
    });

    document.getElementById("ambientColor").addEventListener("change", function(event)
    {
        let newColor = this.value.match(/[A-Za-z0-9]{2}/g).map(function(v) { return (parseInt(v, 16)/256) })
        settings.uniform.ambient_light.buffer.set(newColor, 0);
        gl.clearColor(...newColor, 1.0);
        SubUniformBuffer(settings.uniform.ambient_light.ubo, settings.uniform.ambient_light.buffer);
    });

    document.getElementById("specularIntensity").addEventListener("change", function(event)
    {
        settings.uniform.material.buffer.set([this.value], 3);
        SubUniformBuffer(settings.uniform.material.ubo, settings.uniform.material.buffer);
    });

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

    document.getElementById("diffuseInput").addEventListener("change", uploadTexture("diffuse"));
    document.getElementById("normalInput").addEventListener("change", uploadTexture("normal"));
    document.getElementById("specularInput").addEventListener("change", uploadTexture("specular"));
    document.getElementById("emissiveInput").addEventListener("change", uploadTexture("emissive"));

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

    document.getElementById("resetDiffuse").addEventListener("click", resetTexture("diffuse"));
    document.getElementById("resetNormal").addEventListener("click", resetTexture("normal"));
    document.getElementById("resetSpecular").addEventListener("click", resetTexture("specular"));
    document.getElementById("resetEmissive").addEventListener("click", resetTexture("emissive"));

}

function draw(timestamp)
{
    timestamp = timestamp || 0.0;
    delta_time = ((timestamp - last_time)/1000.0);
    last_time = timestamp;
    // wyczyszczenie ekranu
    gl.clear(gl.COLOR_BUFFER_BIT);

    counter += (rot_speed * delta_time);
    let mvp_matrix = mat4.create();
    settings.mat.M = mat4.create();
    mat4.rotateY(settings.mat.M, settings.mat.M, counter);
    mat4.rotateZ(settings.mat.M, settings.mat.M, Math.PI/2);
    mat4.multiply(mvp_matrix, settings.mat.P, settings.mat.V);
    mat4.multiply(mvp_matrix, mvp_matrix, settings.mat.M);    

    gl.bindBuffer(gl.UNIFORM_BUFFER, settings.uniform.matrices.ubo);
    gl.bufferSubData(gl.UNIFORM_BUFFER,0,Float32Concat(mvp_matrix, settings.mat.M),0,0);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);

    // wyslanie polecania rysowania do GPU (odpalenie shader-ow)
    gl.drawElements(gl.TRIANGLES, 3*2*6, gl.UNSIGNED_SHORT, 0);

    window.requestAnimationFrame(draw);
}

function main()
{
    init();
    draw();
};

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
