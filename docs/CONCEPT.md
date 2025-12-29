Title Idea: node_modules (or The Heavyest Objects in the Universe)

The Concept:
You are not simulating an OS; you are simulating the installation process. The game takes place on an infinite 2D canvas (pan/zoom enabled). You have one central "Root" node. Your goal is to install "The Ultimate Package," but every time you add a module, it recursively pulls in dozens of dependencies, which pull in their own dependencies, creating a sprawling, breathing, chaotic web.

The "Inception" Hook:
Instead of layers of dreams, the inception here is Dependency Recursion.

    The Fractal: You zoom in on a small "utils" package node. Inside that node, you see a tiny animation of another entire dependency tree being built.

    Circular Dependency (The Prestige): Eventually, a tiny leaf node at the bottom of the chain will request... the Root node. Connecting them creates a loop, generating infinite energy (or crashing the system if not stabilized).

The Gameplay Loop:

    The Install: You drag a box (Package) onto your Root Node.

    The Unpacking: The box bursts open. It doesn't just give resources; it shoots out 3 wires that spawn 3 smaller boxes (Dependencies).

    The Chaos: Those 3 boxes immediately shoot out their own wires. The screen fills with a fractal tree of geometry.

    The Management (pnpm Mechanic):

        The tree is getting too big/heavy. The "RAM" bar (a battery icon) is draining.

        Symlinking: You notice two branches are asking for the same red square node. Instead of letting them both spawn one, you drag a wire to link them to a single existing red square. This deletes the duplicate, saving RAM and increasing efficiency.

No Text Mechanics:

    Version Conflicts (The Conflict):

        Sometimes a node turns Red. It has a shape inside it (e.g., a Triangle).

        The node it connects to has a Square socket. They don't fit.

        Solution: You must "update" the node (feed it resources) until its shape morphs from Triangle -> Square.

    Download Speed (The Pace):

        Data flows like water through the pipes.

        Thick pipes = fast data. Thin pipes = slow.

        If a node isn't getting data, it turns gray and pauses the whole branch.

    The "Black Hole" (End Game):

        When the graph gets dense enough, the background starts to warp. The gravity of the node_modules folder becomes visible.

        Nodes start getting sucked toward the center. You have to build structure (struts/beams) to keep them apart, or they collapse into a singularity (Prestige/Reset).

Why this fits the Jam:

    Originality: It turns the "tree" structure of incremental games into the literal physical gameplay. It’s a graph-theory idler.

    Theme (Inception): Recursive dependencies are the programming equivalent of inception.

    No Text: Shapes and colors (Red Triangle vs Green Square) communicate "Version Mismatch" instantly without needing version numbers like v1.2.4.

    Fun/Balance: The satisfaction comes from "Symlinking"—cleaning up the mess. You watch a messy, sprawling tree snap into a neat, interconnected web.

Visual Style:
Think World of Goo meets Hacknet. Dark background, neon connecting lines. When a package "installs," it plays a satisfying "pop-pop-pop" sound as the dependencies unfold like bubble wrap.