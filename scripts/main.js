"use strict";

var gl;

function Float32Concat(first, second)
{
    let first_length = first.length,
        result = new Float32Array(first_length + second.length);
    result.set(first);
    result.set(second, first_length);
    return result;
}
var vp_matrix = mat4.create();
var matrices_ubo = null;
function init()
{
    var m = mat4.create();
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
    var matrices_ubi = gl.getUniformBlockIndex(program, "Matrices");
    var cam_info_ubi = gl.getUniformBlockIndex(program, "CamInfo");
    var material_ubi = gl.getUniformBlockIndex(program, "Material");
    var point_light_ubi = gl.getUniformBlockIndex(program, "PointLight");
    var ambient_light_ubi = gl.getUniformBlockIndex(program, "Ambient");
    var point_lightV_ubi = gl.getUniformBlockIndex(program, "PointLightV");

    // przyporzadkowanie ubi do ubb
    let matrices_ubb = 0;
    gl.uniformBlockBinding(program, matrices_ubi, matrices_ubb);
    let cam_info_ubb = 1;
    gl.uniformBlockBinding(program, cam_info_ubi, cam_info_ubb);
    let material_ubb = 2;
    gl.uniformBlockBinding(program, material_ubi, material_ubb);
    let point_light_ubb = 3;
    gl.uniformBlockBinding(program, point_light_ubi, point_light_ubb);
    let point_lightV_ubb = 4;
    gl.uniformBlockBinding(program, point_lightV_ubi, point_lightV_ubb);
    let ambient_light_ubb = 5;
    gl.uniformBlockBinding(program, ambient_light_ubi, ambient_light_ubb);

    // tworzenie sampler-a
    let diffuseSampler = makeSampler();
    let normalSampler = makeSampler();
    let specularSampler = makeSampler();
    let emissiverSampler = makeSampler();
    
    // tworzenie teksutry
    let diffuse = document.querySelector("#diffuse");
    let normal = document.querySelector("#normal");
    let specular = document.querySelector("#specular");
    let emissive = document.querySelector("#emissive");

    let texdiffuse = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texdiffuse);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, diffuse);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);

    let texnormal = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texnormal);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, normal);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);

    let texspecular = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texspecular);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, specular);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);

    let texemissive = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texemissive);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, emissive);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);

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


    // tworzenie VBO
    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, Pyramid.VertexBuffer, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // tworzenie bufora indeksow
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

    // pozycja kamery
    let cam_pos = new Float32Array([0., 0., 1.5]);

    // dane o macierzy
    var mvp_matrix = mat4.create();
    var model_matrix = mat4.create();
    //mat4.rotateY(model_matrix, model_matrix, Math.PI/4);
    var view_matrix = mat4.create();
    mat4.lookAt(view_matrix, cam_pos, new Float32Array([0., 0., 0.]), new Float32Array([0., 1., 0.]));
    //mat4.lookAt(view_matrix, new Float32Array([0., -2., 2.]), new Float32Array([0., 0., 0.]), new Float32Array([0., 0., 1.]));
    var projection_matrix = mat4.create();
    mat4.perspective(projection_matrix, Math.PI/4., gl.drawingBufferWidth/gl.drawingBufferHeight, 0.01, 10);
    mat4.multiply(mvp_matrix, projection_matrix, view_matrix);
    mat4.copy(vp_matrix,mvp_matrix);
    mat4.multiply(mvp_matrix, mvp_matrix, model_matrix);

    // dane dotyczace materialu
    let material_data = new Float32Array([1., 1., 1., 1., 256]);

    // dane dotyczace swiatla punktowego
    let point_light_data = new Float32Array([-4.0, 0.0, 4, 24., 1.0, 1.0, 1.0]);

    let ambient_light_data = new Float32Array([0.1,0.1,0.1]);
    // tworzenie UBO
    matrices_ubo = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, matrices_ubo);
    gl.bufferData(gl.UNIFORM_BUFFER, Float32Concat(mvp_matrix, model_matrix), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    var cam_info_ubo = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, cam_info_ubo);
    gl.bufferData(gl.UNIFORM_BUFFER, cam_pos, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    var material_ubo = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, material_ubo);
    gl.bufferData(gl.UNIFORM_BUFFER, material_data, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    var point_light_ubo = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, point_light_ubo);
    gl.bufferData(gl.UNIFORM_BUFFER, point_light_data, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);

    var ambient_light_ubo = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, ambient_light_ubo);
    gl.bufferData(gl.UNIFORM_BUFFER, ambient_light_data, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);

    // ustawienia danych dla funkcji draw*
    gl.useProgram(program);
    gl.bindSampler(0, diffuseSampler);
    gl.activeTexture(gl.TEXTURE0 +  0);
    gl.bindTexture(gl.TEXTURE_2D, texdiffuse);
    gl.bindSampler(1, normalSampler);
    gl.activeTexture(gl.TEXTURE0 +  1);
    gl.bindTexture(gl.TEXTURE_2D, texnormal);
    gl.bindSampler(2, specularSampler);
    gl.activeTexture(gl.TEXTURE0 +  2);
    gl.bindTexture(gl.TEXTURE_2D, texspecular);
    gl.bindSampler(3, emissiverSampler);
    gl.activeTexture(gl.TEXTURE0 +  3);
    gl.bindTexture(gl.TEXTURE_2D, texemissive);

    gl.uniform1i(gl.getUniformLocation(program,"color_tex"), 0);
    gl.uniform1i(gl.getUniformLocation(program,"normal_tex"), 1);
    gl.uniform1i(gl.getUniformLocation(program,"specular_tex"), 2);
    gl.uniform1i(gl.getUniformLocation(program,"emissive_tex"), 3);

    gl.bindVertexArray(vao);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, matrices_ubb, matrices_ubo);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, cam_info_ubb, cam_info_ubo);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, material_ubb, material_ubo);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, point_light_ubb, point_light_ubo);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, point_lightV_ubb, point_light_ubo);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, ambient_light_ubb, ambient_light_ubo);


    function makeSampler() {
        var linear_sampler = gl.createSampler();
        gl.samplerParameteri(linear_sampler, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.samplerParameteri(linear_sampler, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.samplerParameteri(linear_sampler, gl.TEXTURE_WRAP_R, gl.REPEAT);
        gl.samplerParameteri(linear_sampler, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.samplerParameteri(linear_sampler, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        return linear_sampler;
    }
}

var counter = 0.0;
const rot_speed = 0.0025;
function draw()
{
    // wyczyszczenie ekranu
    gl.clear(gl.COLOR_BUFFER_BIT);

    counter += rot_speed;
    let mvp_matrix = mat4.create();
    let model_matrix = mat4.create();
    mat4.rotateY(model_matrix, model_matrix, counter);
    mat4.rotateZ(model_matrix, model_matrix, Math.PI/2);
    //mat4.rotateY(model_matrix, model_matrix, counter);
    mat4.multiply(mvp_matrix, vp_matrix, model_matrix);    

    gl.bindBuffer(gl.UNIFORM_BUFFER, matrices_ubo);
    gl.bufferSubData(gl.UNIFORM_BUFFER,0,Float32Concat(mvp_matrix, model_matrix),0,0);
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

    in vec3 position_ws;
    in vec3 vV;
    in vec3 vL;
    in vec2 tex_coord;
    out vec4 vFragColor;

    uniform sampler2D color_tex;
    uniform sampler2D normal_tex;
    uniform sampler2D specular_tex;
    uniform sampler2D emissive_tex;

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

    void main()
    {
        vec3 dist = point_light.position_ws-position_ws;
        vec3 L = normalize(vL);
        vec3 V = normalize(vL);
        vec3 N = normalize(texture(normal_tex,tex_coord).xyz*2.0-1.0);
        vec3 H = normalize(L+V);
        //float attenuation = max(1. - (dist.x*dist.x+dist.y*dist.y+dist.z*dist.z)/point_light.r,0.0);
        float attenuation = 1.0/ (1.0 + (dist.x*dist.x+dist.y*dist.y+dist.z*dist.z)*0.04);
        attenuation *= 1.0 - step(point_light.r,length(dist));
        vec4 tex_color = texture(color_tex,tex_coord);
        vec3 diffuse = material.color*point_light.color*max(dot(N,L),0.0);
        diffuse *= attenuation;
        vec3 specular = pow(max(dot(H,N),0.0),material.specular_power)*point_light.color;
        specular *= attenuation;
        specular *= texture(specular_tex,tex_coord).xyz;
        vec3 emissive = (tex_color*texture(emissive_tex,tex_coord)).xyz;
        vFragColor = vec4(clamp(tex_color.rgb*(ambient_light.color*material.color+diffuse)+specular+emissive,0.f,1.f),1.0);
    }`;
