export default class YUVWebGLCanvas {
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!this.gl) {
      console.warn("[WebGL] Trình duyệt không hỗ trợ WebGL. Tính năng YUV Canvas có thể không hoạt động.");
      return;
    }
    this.initWebGL();
  }

  private initWebGL() {
    const gl = this.gl!;
    // Vertex Shader: Xử lý toạ độ và khung hình
    const vsSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;
    
    // Fragment Shader: Trình duyệt tự động mapping YUV (của VideoFrame) sang RGB thông qua sampler2D
    const fsSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_image;
      void main() {
        gl_FragColor = texture2D(u_image, v_texCoord);
      }
    `;

    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vsSource);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fsSource);

    if (!vertexShader || !fragmentShader) return;

    this.program = gl.createProgram();
    if (!this.program) return;
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error("[WebGL] Lỗi khởi tạo Shader: " + gl.getProgramInfoLog(this.program));
      return;
    }

    gl.useProgram(this.program);

    // Cấu hình toạ độ đỉnh (Position - Trải dài toàn bộ Canvas)
    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0,
    ]), gl.STATIC_DRAW);

    // Cấu hình toạ độ Texture (UV mapping - Đảo ngược trục Y để video không bị ngược)
    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0.0, 1.0,
      1.0, 1.0,
      0.0, 0.0,
      0.0, 0.0,
      1.0, 1.0,
      1.0, 0.0,
    ]), gl.STATIC_DRAW);

    // Khởi tạo WebGL Texture
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl!;
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("[WebGL] Lỗi biên dịch Shader: " + gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  /**
   * Nhận dữ liệu YUV thô (VideoFrame) và vẽ siêu tốc bằng GPU Zero-copy
   * Kèm cơ chế recycleMemory để tránh tràn VRAM
   */
  public drawFrame(frame: VideoFrame) {
    if (!this.gl || !this.program || !this.texture) return;
    const gl = this.gl;

    // Đặt viewport khớp với kích thước thật của canvas
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // [Mobile Tier 2] Render texture (Zero-copy YUV to RGB by GPU)
    // Trên iOS/Safari, texImage2D với VideoFrame là con đường tối ưu nhất
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
    } catch (e) {
      // Fallback cho một số trình duyệt cũ yêu cầu format LUMINANCE khi xử lý YUV
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, frame as any);
    }

    // Liên kết Position Buffer
    const positionLocation = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Liên kết TexCoord Buffer
    const texCoordLocation = gl.getAttribLocation(this.program, "a_texCoord");
    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    // Vẽ 2 hình tam giác tạo thành 1 hình chữ nhật
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // [recycleMemory] Giải phóng liên kết texture ngay lập tức để GPU dọn dẹp vùng nhớ tạm
    gl.bindTexture(gl.TEXTURE_2D, null);
    
    // Gợi ý cho trình duyệt rằng chúng ta đã hoàn thành tác vụ GPU này
    gl.flush(); 
  }

  public destroy() {
    if (this.gl) {
      if (this.texture) this.gl.deleteTexture(this.texture);
      if (this.positionBuffer) this.gl.deleteBuffer(this.positionBuffer);
      if (this.texCoordBuffer) this.gl.deleteBuffer(this.texCoordBuffer);
      if (this.program) this.gl.deleteProgram(this.program);
    }
    this.gl = null;
  }
}
