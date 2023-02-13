import ghpythonlib.components as gh
import rhinoscriptsyntax as rs 
import Rhino as rc 
import scriptcontext as sc
from itertools import chain
from itertools import groupby
import math
import operator 
from operator import itemgetter


        
#returns the index of the minimum element in an array
def argmin(a):
    return min(enumerate(a), key=itemgetter(1))[0]
    
#returns the index of the maximum element in an array
def argmax(a):
    return max(enumerate(a), key=itemgetter(1))[0]
    
#returns the index of an element in a if it is equal to an element in b
def argeq(a,b):
    a_index = None
    for i in range(len(b)):
        for j in range(len(a)):
            if(abs(b[i][0]-a[j][0])<0.1 and abs(b[i][1]-a[j][1])<0.1):
                a_index = j
    return a_index
    
"""
Definition:
    a Corner is a data structure that contains information on the intersection 
    between two line segments and how 
"""
class Corner:
    def __init__(self, leg_a, vertex, leg_b):
        self.prev = None
        self.vertex = vertex
        self.next = None
        self.prev_edge = leg_a
        self.next_edge = leg_b
        self.vertical, self.horizontal = self.assignLegs(leg_a,leg_b)
        self.concave = False 
        self.xcol = None
        self.ycol = None 
        
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
        self.length = 0
        self.concave_count = 0 
        self.colinear_pairs = 0 
        
    def make(self, new_corner): 
        new_corner.next = self.head
        if(self.head!=None):
            self.head.prev = new_corner
        else: 
            self.tail = new_corner
        self.head = new_corner
        self.head.prev = self.tail
        self.tail.next = self.head
        self.length+=1

    def insert(self, prev_corner, prev_edge, vertex, next_edge): 
        new_corner = Corner(prev_edge, vertex, next_edge)
        new_corner.next = prev_corner.next
        prev_corner.next = new_corner
        new_corner.prev = prev_corner
        self.length+=1
        
    def get(self, vertex):
        target = None
        point = self.head
        while(target==None):
            if(point.vertex==vertex):
                target = point
            else: 
                point = point.next
        return target
    
    def list_pop(self, corner):
        corner.prev.next = corner.next
        corner.next.prev = corner.prev
        self.length-=1
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
    bounding = gh.Rectangle2Pt(gh.XYPlane(vertices[left]),top_left,bot_right,0).rectangle
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
    if(len(curve)>1):
        inside = 0 
        max_area_index = argmax(gh.Area(curve).area)
        curve.insert(0,curve.pop(max_area_index))
    else:
        inside = 0
    corners = cornerList()
    for i in range(len(curve)):
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
            new_corner = Corner(leg_b, V, leg_a)
            if(j==0):
                sign = dot
                if(i>inside):
                    concave.append(V)
                    new_corner.concave=True
                    corners.concave_count+=1
            elif(i==inside and dot!=sign):
                concave.append(V)
                new_corner.concave=True
                corners.concave_count+=1
            elif(i>inside and dot==sign):
                concave.append(V)
                new_corner.concave=True
                corners.concave_count+=1
                
            corners.make(new_corner)
    return concave, labelled_edges, corners, bounding

def findCogridVertices(concave, ind):
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
    
def extendCurve(corner,corner_list,dir):
    opdir = (dir+1)%2
    if(dir==0):
        ray = corner.horizontal 
    else: 
        ray = corner.vertical
    endpts = gh.EndPoints(ray)
    vertex = corner.vertex
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
        
    gate = True
    current_corner = corner.next
    
    while(current_corner!=corner):
        start, end = gh.EndPoints(current_corner.next_edge)
        min_end = min(start[dir],end[dir])
        if(oper(start[dir],vertex[dir]) and oper(end[dir],vertex[dir])):
            if(gate):
                intersect = min_end
                intersection_corner = current_corner
                gate = False                                                     
            if(min(start[opdir],end[opdir])<=vertex[opdir]):
                if(max(start[opdir],end[opdir])>=vertex[opdir]):
                    if (min_end<intersect):
                        intersect = min_end
                        intersection_corner = current_corner                
        current_corner = current_corner.next
        
    ext_length = abs(getattr(endpts,extend_point)[dir]-intersect)
    return gh.LineSDL(vertex,vect.vector,ext_length), intersection_corner

def updateColCounts(shortlist, longlist, corner, dir):
    col = getattr(corner,dir)
    if(col!=None):
        if(shortlist.get(col)==None):
            comp_corner = longlist.get(col)
            setattr(comp_corner,ycol,None)
            setattr(corner,ycol,None)
            shortlist.colinear_count-=1
            longlist.colinear_count-=1
            
def updateColinearCorners(a_list, b_list):
    if(a_list.length>=b_list.length):
        shortlist = b_list
        longlist = a_list
    else: 
        shortlist = a_list
        longlist = b_list
    curcorn = shortlist.head
    for i in range(shortlist.length): 
        updateColCounts(shortlist, longlist, curcorn, 'ycol')
        updateColCounts(shortlist, longlist, curcorn, 'xcol')
        curcorn = curcorn.next

def cornersToCurve(corner_list): 
    segments = []
    curcorner = corner_list.head
    for i in range(corner_list.length+1): 
        segments.append(curcorner.next_edge)
        curcorner = curcorner.next
    curve = gh.JoinCurves(segments,False)
    return curve
"""
Definitions:
leg_a: vertex edge parallel to chord 
leg_b: vertex edge perpindicular to chord
Region A is the region formed by joining the chord leg a
Region B is the region formed by taking the chord as a standalone segment

"""
def doPartition(ext_corner, chord, intersection_corner, a_list, dir):
    opdir = (dir+1)%2
    intersection_edge = intersection_corner.next_edge
    endpts = gh.EndPoints(intersection_edge)
    intersection_vertex = chord[1]
    if(gh.CrossProduct(chord,ext_corner.next_edge,True).length==0):
        print("switching")
        forward = "prev"
        reverse = "next"
    else: 
        print("not switching")
        forward = "next"
        reverse = "prev"
    forward_edge = forward+"_edge"
    reverse_edge = reverse+"_edge"
    ab_shard = [gh.Line(chord[1],endpts.start),gh.Line(chord[1],endpts.end)] #assign split shards: index 0=a, index 1=b
    if(gh.CrossProduct(ab_shard[0],chord,True).vector==gh.CrossProduct(chord,getattr(ext_corner,forward_edge),True).vector):
        ab_shard = ab_shard[::-1]
    
    b_list = cornerList()
    current_corner = ext_corner
    target = getattr(intersection_corner, forward)
    prev = getattr(ext_corner, reverse)
  
    a_seg = gh.JoinCurves([chord,getattr(ext_corner,reverse_edge)],False)
    setattr(prev,forward_edge,a_seg)
    setattr(target,reverse_edge,a_seg)
    setattr(intersection_corner,forward_edge,ab_shard[0])
    
    while(current_corner!=target):
        tmp = getattr(current_corner,forward)
        b_list.make(a_list.list_pop(current_corner))
        if(current_corner.concave):
            a_list.concave_count-=1
            b_list.concave_count+=1
        current_corner = tmp
    
    setattr(intersection_corner,forward_edge,ab_shard[1])
    if(forward=="next"):
        a_list.insert(prev,a_seg,intersection_vertex,ab_shard[0])
        b_list.make(Corner(ab_shard[1],intersection_vertex,chord))
    else:
        a_list.insert(target,ab_shard[0],intersection_vertex,a_seg)
        b_list.make(Corner(chord,intersection_vertex,ab_shard[1]))
    
    #updateColinearCorners(a_list,b_list)
    return a_list, b_list, intersection_vertex
    
def iterLoop(corners): 
    current_corner = corners.head
    edges = []
    vertices = []
    for i in range(corners.length):
        edges.append(current_corner.next_edge)
        vertices.append(current_corner.vertex)
        current_corner = current_corner.next
    return edges, vertices
"""
Extension Logic: 
    -loop:
        -pick x_col/y_col based on bias dir
        -extendCurve(biased_col[i][bias_dir])
        
"""    
def nonDegenerateDecomposition(dir,corner_list,regions):
    print(corner_list.concave_count)
    if(corner_list.concave_count==0):
        regions.append(cornersToCurve(corner_list))
    else:
        curcorner = corner_list.head
        while(curcorner.concave==False): 
            curcorner = curcorner.next
        chord, intersection_corner = extendCurve(curcorner,corner_list,dir)
        a_list, b_list, vertex = doPartition(curcorner, chord, intersection_corner, corner_list, dir)
        edges, vertex = iterLoop(b_list)
        return cornersToCurve(b_list), vertex, edges 
#        print(a_list.concave_count, b_list.concave_count)
#        nonDegenerateDecomposition(dir,a_list,regions)
#        nonDegenerateDecomposition(dir,b_list,regions)    
        
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


    
concave, labelled_edges, corners, bounding = filterConcaveVertices(curve)
x_col = findCogridVertices(concave, 0)
y_col = findCogridVertices(concave, 1)
deconstruct_bound = gh.DeconstuctRectangle(bounding)
if(deconstruct_bound.x_interval>=deconstruct_bound.y_interval):
    bias_dir=0
    cogrid_pairs = x_col+y_col
else: 
    bias_dir=1
    cogrid_pairs = y_col+x_col
regions, vertex, curr_edge = nonDegenerateDecomposition(bias_dir, corners, [])
#chord, intersection_corner = extendCurve(corners.head.next,corners,bias_dir)
#intersection_corner = intersection_corner.next_edge
#extpoint = corners.head.next.vertex
#regions,vertex,edge = nonDegenerateDecomposition(bias_dir, corners, regions)

#for Degenerate Decomp:
    #deg_chords = constructChords(cogrid_pairs, labelled_edges)

#chord, intersection_corner = extendCurve(y_col[0][1],corners[0],0)
"""
Degenerate decomposition: 
    -follow steps for maximum matching, etc.  
    -eventually calls nondeg 
    
Non-Degenerate decomposition:
     (Recursive) 
     Base Case: check for concavity
     Step: 
        -Extend @ concave vertex 
            Inputs: segments, vertex, corners, dir
            Outputs: chord, index of intersection, segments
             a. if len(x_col|y_col)>0 extend from these vertices accordingly 
             b. otherwise bias extension toward floorplan's max dimension 
        -Do partition with new chord 
            Inputs: vertex, index of intersection, segments, chord, corners, dir
            Outputs: a_list, b_list

Ideas on how to combine extendCurve and doPartition: 
    x-rewrite for loop in extendCurve to while with corners (get rid of segments input)
    x-add data to corners to hold info on whether vertex is concave, cogrid, etc.
    x-store number of concave, cogrid, etc. in list
    x-update list methods to account for new data field (i.e. pop should dock count by 1) 
    
"""

        
        
        
