import ghpythonlib.components as gh
import rhinoscriptsyntax as rs 
import Rhino as rc 
import scriptcontext as sc
from itertools import chain
import math
from operator import itemgetter
import random 

def argmin(a):
    return min(enumerate(a), key=itemgetter(1))[0]
    
def shortestSegment(csrf):  
    c_edge = gh.BrepEdges(csrf).naked
    c_join = gh.JoinCurves(c_edge,False)
    c_exp = gh.Explode(c_join,True).segments
    c_ext = gh.ExtendCurve(c_exp,0,0.001,0.001)
    c_add = gh.Addition(gh.GateNot(gh.SurfaceClosestPoint(gh.EndPoints(c_ext).start,csrf).distance),
                        gh.GateNot(gh.SurfaceClosestPoint(gh.EndPoints(c_ext).end,csrf).distance))
    c_add = gh.Addition(gh.Multiplication(gh.MassAddition(gh.Length(c_join)).result,c_add),
                        gh.Length(c_exp))
    c_series = gh.Series(0,1,gh.ListLength(c_exp))
    c_shortest = gh.ListItem(gh.SortList(c_add,c_series).values_a,0,True)
    return c_exp, c_series, int(c_shortest)

def getAdjacentSegments(segments, series, shortest):
    cull = segments[0:shortest]+segments[shortest+1:]
    adj_a = gh.CurveClosestPoint(gh.EndPoints(segments[shortest]).start,cull).distance
    adj_a.insert(shortest, 9999)
    adj_b = gh.CurveClosestPoint(gh.EndPoints(segments[shortest]).end,cull).distance
    adj_b.insert(shortest, 9999)
    return [argmin(adj_a),shortest,argmin(adj_b)]

def lastRectangle(outline,ext):
    a = gh.Area(outline)
    b = gh.Area(ext)
    cent_dist = gh.Distance(a.centroid,b.centroid)
    abs_dif = gh.Absolute(gh.Subtraction(a.area,b.area))
    return (abs_dif<0.01 and cent_dist<0.01)
    
    
outline = gh.BoundarySurfaces(curve)
output = []
i = True
while(i==True):
    segments, series, shortest = shortestSegment(outline)
    adjacents = getAdjacentSegments(segments, series, shortest)
    arm_a = segments[adjacents[0]]
    base = segments[adjacents[1]]
    arm_b = segments[adjacents[2]]
    adjs = [arm_a,base,arm_b]
    vec = gh.Vector2Pt(gh.EndPoints(base).start,gh.EndPoints(arm_a).start,False).vector
    min_arm = gh.Minimum(gh.Length(arm_a),gh.Length(arm_b))
    wo_adj = list(segments)
    for index in sorted(adjacents, reverse=True):
        del wo_adj[index]
    intersects = gh.CurveXCurve(gh.LineSDL(gh.DivideCurve(base,50,False).points[:-1],vec,min_arm),wo_adj).params_a
    if(isinstance(intersects, list)):
        mult = gh.Multiplication(min_arm, min(intersects))
    elif(isinstance(intersects,float)):
        mult = gh.Multiplication(min_arm,intersects)
    else:
        mult = min_arm
    amp = gh.Amplitude(vec,mult)
    ext = gh.Extrude(base,amp)
    b_solid = gh.Extrude(gh.Move(ext,gh.VectorXYZ(0,0,-1).vector).geometry,gh.VectorXYZ(0,0,2).vector)
    b_edges = gh.BrepEdges(gh.TrimSolid(outline,b_solid)).naked
    b_curves = gh.JoinCurves(b_edges,False)
    if(isinstance(b_curves,list)):
        poly = []
        for c in b_curves:
            poly.append(gh.PolyLine(gh.Discontinuity(c,1).points,True))
    else:
        poly = gh.PolyLine(gh.Discontinuity(b_curves,1).points,True)
    output.append(ext)
    if(lastRectangle(outline,ext)):
        i=False
    else: 
        outline = gh.BoundarySurfaces(poly)
a = output


    
