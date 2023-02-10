import ghpythonlib.components as gh
import rhinoscriptsyntax as rs 
import Rhino as rc 
import scriptcontext as sc
from itertools import chain
from itertools import groupby
import math
import operator 
from operator import itemgetter
import random 
        
def argmin(a):
    return min(enumerate(a), key=itemgetter(1))[0]
        
def argmax(a):
    return max(enumerate(a), key=itemgetter(1))[0]
        
def argeq(a,b):
    a_index = None
    for i in range(len(b)):
        for j in range(len(a)):
            if(abs(b[i][0]-a[j][0])<0.1 and abs(b[i][1]-a[j][1])<0.1):
                a_index = j
    return a_index
            
class Corner:
    def __init__(self, prev_edge, vertex, next_edge):
        self.prev = None
        self.prev_edge = prev_edge
        self.vertex = vertex
        self.next = None
        self.next_edge = next_edge
        self.vertical, self.horizontal = self.assignLegs(prev_edge,next_edge)
        
    def assignLegs(self,leg_a,leg_b):
        endpts = gh.EndPoints(leg_a)
        if(endpts[0][0]==endpts[1][0]):
            vertical = leg_a
            horizontal = leg_b
        else: 
            vertical = leg_b 
            horizontal = leg_a
        return vertical,horizontal

class cornerList: 
    def __init__(self):
        self.head = None
        self.tail = None
        
    def make(self, prev_edge, vertex, next_edge): 
        new_corner = Corner(prev_edge, vertex, next_edge)
        new_corner.next = self.head
        if(self.head!=None):
            self.head.prev = new_corner
        else: 
            self.tail = new_corner
        self.head = new_corner
        self.tail.next = self.head
    
    def push(self, existing_corner):
        existing_corner.next = self.head
        if(self.head!=None):
            self.head.prev = existing_corner
        self.head = existing_corner 

    def insert(self, prev_corner, prev_edge, vertex, next_edge): 
        new_corner = Corner(prev_edge, vertex, next_edge)
        new_corner.next = prev_corner.next
        prev_corner.next = new_corner
        new_corner.prev = prev_corner
            
    def get(self, vertex):
        target = None
        point = self.head
        while(target==None):
            if(point.vertex==vertex):
                target = point
            else: 
                point = point.next
        return target
    
    def list_pop(corner):
        corner.prev.next = corner.next
        corner.next.prev = corner.prev
        return corner
        
def drawBounding(vertices): 
    left, right, top, bottom = 0,0,0,0
    for i in range(len(vertices)):
        if(vertices[i][0]<left): 
            left = i
        if(vertices[i][0]>right):
            right = i
        if(vertices[i][1]<top):
            top = i
        if(vertices[i][1]>bottom):
            bottom = i
    top_left = gh.ConstructPoint(vertices[left][0],vertices[top][1],0)
    bot_right = gh.ConstructPoint(vertices[right][0],vertices[bottom][1],0)
    bounding = gh.Rectangle2Pt(gh.XYPlane(vertices[left]),top_left,bot_right,0)
    return bounding, left

"""
A leftmost point must be convex.
Call that vertex V, the previous one is U and the next one is W.
Find the vectors a = U - V and b = W - V. Now compute z = ax * by - ay * bx and note the sign of z.
(This is the z component of the cross product [a 0] X [b 0]. The sign says whether going from U to V to W is a "left turn" or "right turn" in the 2D plane.)
Then continue around the polygon. At each vertex do the same computation where V is the current vertex, U the previous one, and W the next. If the result has the same sign as the first, it's concave, else convex.
"""    
def filterConcaveVertices(curve):
    concave = []
    labelled_edges = []
    corners = []
    if(len(curve)>1):
        inside = 0 
        max_area_index = argmax(gh.Area(curve).area)
        curve.insert(0,curve.pop(max_area_index))
    else:
        inside = 0
    for i in range(len(curve)):
        corners.append(cornerList())
        edges, vertices = gh.Explode(curve[i],False)
        vertices.pop(-1)
        bounding, leftmost = drawBounding(vertices)
        for j in range(len(vertices)):
            V = vertices[(leftmost+j)%len(vertices)]
            leg_a = edges[(leftmost+j-1)%len(vertices)]
            leg_b = edges[(leftmost+j)%len(vertices)]
            z = gh.CrossProduct(leg_a,leg_b,False).vector
            dot = gh.DotProduct(z,gh.UnitZ(1),True)
            labelled_edges.append(sorted(gh.EndPoints(leg_a),key=lambda coor: (coor[0],coor[1])))
            corners[-1].make(leg_a, V, leg_b)
            if(j==0):
                sign = dot
                if(i>inside):
                    concave.append(V)
            elif(i==inside and dot!=sign):
                concave.append(V)
            elif(i>inside and dot==sign):
                concave.append(V)
    return vertices, concave, labelled_edges, corners, bounding

def cogridVertices(concave, ind):
    sorted_concave = sorted(concave, key=lambda coor: (coor[ind], coor[(ind+1)%2])) 
    mark = sorted_concave[0]
    matched = False
    colinear = []
    for i in range(1,len(sorted_concave)):
        if(mark[ind]==sorted_concave[i][ind]):
            colinear.append([mark,sorted_concave[i]])
        mark = sorted_concave[i]
    return colinear 
        
def constructChords(cogrid_pairs, labelled_edges):
    chords = []
    for i in range(len(cogrid_pairs)): 
        for j in range(len(cogrid_pairs[i])-1):
            if([cogrid_pairs[i][j],cogrid_pairs[i][j+1]] not in labelled_edges):
                if([cogrid_pairs[i][j+1],cogrid_pairs[i][j]] not in labelled_edges):
                    chords.append(gh.Line(cogrid_pairs[i][j],cogrid_pairs[i][j+1]))
    return chords
    
def extendCurve(segments,vertex,corners,dir):
    opdir = (dir+1)%2
    if(dir==0):
        ray = corners[-1].get(vertex).horizontal 
    else: 
        ray =  corners[-1].get(vertex).vertical
    endpts = gh.EndPoints(ray)
    if(vertex==endpts.start):
        vect = gh.Vector2Pt(endpts[1],vertex,False)
        extend_point = 'start'
    else: 
        vect = gh.Vector2Pt(endpts[0],vertex,False)
        extend_point = 'end'
        
    if(gh.DotProduct(gh.VectorXYZ(1,1,1).vector,vect.vector,True)<0):
        oper = operator.lt
    else: 
        oper = operator.gt
        
    starts, ends = gh.EndPoints(segments)
    gate = True
    for i in range(len(segments)):
        if(oper(starts[i][dir],vertex[dir]) and oper(ends[i][dir],vertex[dir])):                                                    
            if(min(starts[i][opdir],ends[i][opdir])<=vertex[opdir]):
                if(max(starts[i][opdir],ends[i][opdir])>=vertex[opdir]):
                    min_end = min(starts[i][dir],ends[i][dir])
                    if(gate): 
                        intersect = min_end
                        gate = False 
                        segsect = i
                    else: 
                        if (min_end<intersect):
                            intersect = min_end
                            segsect= i 
    ext_length = abs(getattr(endpts,extend_point)[dir]-intersect)
    return gh.LineSDL(vertex,vect.vector,ext_length), segsect, segments
    

"""
Definitions:
leg_a: vertex edge parallel to chord 
leg_b: vertex edge perpindicular to chord
Region A is the region formed by joining the chord leg a
Region B is the region formed by taking the chord as a standalone segment

"""
def doPartition(vertex, ind_sect, segments, chord, a_list, dir):
    opdir = (dir+1)%2
    intersection_edge = segments[ind_sect]
    endpts = gh.EndPoints(intersection_edge)
    param_len = (chord[1][opdir]-min(endpts)[opdir])/(max(endpts)[opdir]-min(endpts)[opdir])
    concave = a_list.get(vertex)
    intersection_vertex = gh.EvaluateLength(intersection_edge,param_len,False).param
    split = gh.Shatter(intersection_edge,intersection_vertex)
    
    #set forward iteration direction as that which iterates around region B from concave corner
    forward = "next"
    reverse = "prev"
    if(gh.CrossProduct(chord,concave.next_edge,False)==0):
        forward = "prev"
        reverse = "next"
    forward_edge = forward+"_edge"
    reverse_edge = reverse+"_edge"
    
    ab_shard = split #assign split shards: index 0=a, index 1=b
    if(gh.CrossProduct(split[0],chord,True)==gh.CrossProduct(chord,getattr(concave,forward_edge),True)):
        ab_shard = ab_shard[::-1]
    
    b_list = cornerList()
    
    current_corner = getattr(concave,forward)
    while(getattr(current_corner,reverse_edge)!=intersection_edge):
        b_list.push(a_list.pop(current_corner))
        current_corner = getattr(current_corner,forward)
    if(forward=="next"):
        a_corner = a_list.insert(concave,chord,intersection_vertex,ab_shard[0])                                             
        b_corner = b_list.make(ab_shard[1],intersection_vertex,chord)
    else: 
        a_corner = a_list.insert(current_corner,ab_shard[0],intersection_vertex,chord)
        b_corner = b_list.make(chord,intersection_vertex,ab_shard[0])
        
    a_seg = gh.JoinCurves([chord,getattr(concave,reverse_edge)],False)
    setattr(getattr(concave,reverse),forward_edge,a_seg)
    setattr(getattr(concave,forward),reverse_edge,a_seg)
    setattr(concave,reverse_edge,chord)
    b_list.push(a_list.pop(concave))
    
"""
Main: 
I. filterConcaveVertices
II. find horziontal colinear vertices 
III. find vertical colinear vertices 
IV. if any exist, construct chords between cogrid vertices
V. Decompose
    a. Degenerate Decomposition 
        i. find maximum matching of a bipartite graph
    b. Non-degenerate Decomposition 
        i. extend curve at each concave vertex (choice between horizontal 
            and vertical can be random but favor whichever direction is parallel 
            with the longest length of the bounding box) 
        ii. doPartition 
            -create new vertex
            -traverse cornerslist in one direction until new region is closed 
                -while traversing, pop corners from old list and insert into new list
"""
def main():
    vertices, concave, labelled_edges, corners, bounding = filterConcaveVertices(curve)
    x_col = cogridVertices(concave, 0)
    y_col = cogridVertices(concave, 1)
    cogrid_pairs = x_col+y_col
    chords = constructChords(cogrid_pairs, labelled_edges)
    chords, ind_sect, segments = extendCurve(gh.Explode(curve,False).segments,y_col[1][1],corners,1)
    """
    Degenerate decomposition: 
        -follow steps for maximum matching, etc.  
        -eventually calls nondeg 
        
    Non-Degenerate decomposition:
         (Recursive) 
         Base Case: check for concavity
        -Extend each concave vertex
            a. if len(x_col|y_col)>0 extend from these vertices accordingly 
            b. otherwise bias extension toward floorplan's max dimension 
    """
if __name__ == "__main__":
    main()
        
        
        
