import { reefVertex } from './shaders.js';
import type { Run, Site } from '../game/types.js';
declare const BABYLON: any;
const depthFragment = `precision highp float;
void main(){
 vec4 packed=fract(min(gl_FragCoord.z,.999999)*vec4(1.0,255.0,65025.0,16581375.0));
 packed-=packed.yzww*vec4(1.0/255.0,1.0/255.0,1.0/255.0,0.0);
 gl_FragColor=packed;
}`;
/** Geometry-based depth maps: shared deformation shaders keep caster silhouettes
 * aligned with animated coral, seaweed and thin-instanced fish. High only. */
export class ReefShadows {
    white: any;
    sun: any = null;
    torch: any = null;
    sunTexture: any;
    torchTexture: any;
    sunMatrix: any;
    torchMatrix: any;
    depthMaterials = new Map<number, any>();
    sunPass: number;
    torchPass: number;
    lastSun = -99;
    sunRenders = 0;
    torchRenders = 0;
    lastDraws = 0;
    passReady = true;
    sunDirection: any;
    enabled = false;
    constructor(public scene: any, public engine: any) {
        const B = BABYLON;
        this.white = B.RawTexture.CreateRGBATexture(new Uint8Array([255,255,255,255]),1,1,scene,false,false,B.Texture.NEAREST_SAMPLINGMODE);
        this.sunMatrix = B.Matrix.Identity();this.torchMatrix = B.Matrix.Identity();
        this.sunDirection = new B.Vector3(-.4,1,-.23).normalize();
        this.sunPass = engine.createRenderPassId('reef-sun-shadow');this.torchPass = engine.createRenderPassId('reef-torch-shadow');
        B.Effect.ShadersStore['reefShadowVertexShader']=reefVertex;B.Effect.ShadersStore['reefShadowFragmentShader']=depthFragment;
    }
    target(size: number) {
        const B = BABYLON;
        const wrapper = this.engine.createRenderTargetTexture(size,{generateMipMaps:false,generateDepthBuffer:true,generateStencilBuffer:false,type:B.Constants.TEXTURETYPE_UNSIGNED_BYTE,format:B.Constants.TEXTUREFORMAT_RGBA,samplingMode:B.Texture.NEAREST_SAMPLINGMODE});
        const texture = new B.Texture(null,this.scene,true,false,B.Texture.NEAREST_SAMPLINGMODE);
        texture._texture = wrapper.texture;texture.wrapU=B.Texture.CLAMP_ADDRESSMODE;texture.wrapV=B.Texture.CLAMP_ADDRESSMODE;
        return {wrapper,texture};
    }
    configure(high: boolean) {
        this.enabled = high;
        if (high && !this.sun) {
            this.sun=this.target(2048);this.torch=this.target(1024);this.lastSun=-99;
        }
        if (!high && this.sun) {
            for(const target of [this.sun,this.torch]) {target.texture._texture=null;target.texture.dispose();target.wrapper.dispose();}
            this.sun=this.torch=null;
        }
        this.sunTexture=this.sun?.texture||this.white;this.torchTexture=this.torch?.texture||this.white;
    }
    reset() { this.lastSun=-99; }
    depth(mode: number) {
        let material=this.depthMaterials.get(mode);if(material)return material;
        const B=BABYLON;
        material=new B.ShaderMaterial('reef-shadow-'+mode,this.scene,{vertex:'reefShadow',fragment:'reefShadow'},{attributes:['position','normal','color','uv'],uniforms:['world','viewProjection','uTime','uMode','uLionfishDefense','uMotion','uSurface','uNight','uCurrent']});
        material.backFaceCulling=false;material.setFloat('uMode',mode);material.setFloat('uLionfishDefense',0);material.setFloat('uMotion',1);
        this.depthMaterials.set(mode,material);return material;
    }
    pass(target: any, passId: number, view: any, projection: any, run: Run, site: Site, reducedMotion: boolean) {
        const B=BABYLON,oldView=this.scene.activeCamera.getViewMatrix(),oldProjection=this.scene.activeCamera.getProjectionMatrix(),oldPass=this.engine.currentRenderPassId;
        let draws=0;this.passReady=true;
        try {
            this.engine.currentRenderPassId=passId;this.scene.setTransformMatrix(view,projection);this.scene.resetCachedMaterial();
            this.engine.bindFramebuffer(target.wrapper,undefined,undefined,undefined,true);
            this.engine.setAlphaMode(B.Engine.ALPHA_DISABLE);this.engine.setDepthBuffer(true);this.engine.setDepthWrite(true);
            this.engine.clear(new B.Color4(1,1,1,1),true,true,false);
            for(const mesh of this.scene.meshes) {
                const mode=mesh.material?._reefMode;
                if(![0,1,2,7].includes(mode)||!mesh.isEnabled()||!mesh.isVisible)continue;
                const material=this.depth(mode);
                material.setFloat('uTime',run.time);material.setFloat('uSurface',site.surface);material.setFloat('uMotion',reducedMotion?0:1);
                material.setVector2('uCurrent',{x:site.current,y:site.channelX??(site.id==='gardens'?18:0)});
                mesh.setMaterialForRenderPass(passId,material);mesh.computeWorldMatrix(true);
                if(!material.isReady(mesh,mesh.hasThinInstances)){this.passReady=false;continue;}
                for(const sub of mesh.subMeshes||[]){mesh.render(sub,false);draws++;}
            }
        } finally {
            this.engine.restoreDefaultFramebuffer();this.engine.currentRenderPassId=oldPass;
            this.scene.setTransformMatrix(oldView,oldProjection);this.scene.resetCachedMaterial();
        }
        return draws;
    }
    render(run: Run,site: Site,reducedMotion: boolean,torchActive: boolean,camera: any) {
        if(!this.enabled||!this.sun)return;
        const B=BABYLON;this.lastDraws=0;
        if(run.time-this.lastSun>=.05||run.time<this.lastSun) {
            const center=new B.Vector3(0,-3,0),eye=center.add(this.sunDirection.scale(100));
            const view=B.Matrix.LookAtLH(eye,center,new B.Vector3(0,1,0)),projection=B.Matrix.OrthoLH(160,160,1,190);
            view.multiplyToRef(projection,this.sunMatrix);
            this.lastDraws+=this.pass(this.sun,this.sunPass,view,projection,run,site,reducedMotion);
            if(this.passReady)this.lastSun=run.time;this.sunRenders++;
        }
        if(torchActive) {
            const view=camera.getViewMatrix(),projection=B.Matrix.PerspectiveFovLH(1.35,1,.08,70);
            view.multiplyToRef(projection,this.torchMatrix);
            this.lastDraws+=this.pass(this.torch,this.torchPass,view,projection,run,site,reducedMotion);this.torchRenders++;
        }
    }
    stats() {return {enabled:this.enabled,sunResolution:this.sun?2048:0,torchResolution:this.torch?1024:0,sunRenders:this.sunRenders,torchRenders:this.torchRenders,depthDraws:this.lastDraws};}
}
