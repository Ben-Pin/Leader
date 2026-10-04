// Fictional woodland companies. Reserved .example domains never identify real contacts.
export const DEMO_LISTS = [
  { id: 'demo-leads', name: 'Leads', color: '#D65C59' },
  { id: 'demo-prospects', name: 'Prospects', color: '#DC913D' },
  { id: 'demo-opportunities', name: 'Opportunities', color: '#C4AA35' },
  { id: 'demo-clients', name: 'Customers', color: '#4E9F69' },
  { id: 'demo-partners', name: 'Partners', color: '#4C83CB' },
  { id: 'demo-agents', name: 'Agents', color: '#9765CE' },
];
export const DEMO_TAGS = [
  { id: 'demo-nuts', name: 'Nuts', color: '#AF8546', category: 'Product' },
  { id: 'demo-vegetables', name: 'Vegetables', color: '#5D9D62', category: 'Product' },
  { id: 'demo-fruit', name: 'Fruit', color: '#CD745F', category: 'Product' },
  { id: 'demo-samples', name: 'Samples', color: '#6687C1', category: 'Stage' },
  { id: 'demo-winter', name: 'Winter pantry', color: '#8378B3', category: 'Application' },
];
const contact=(id,name,role,email,status='active')=>({id,name,role,email,status});
const record=(title,country,listId,accountType,description,contacts,lastContact,extra={})=>({title,company:title,country,listId,accountType,description:'Fictional demo company. '+description,contacts,lastContact,status:'contact',tagIds:[],...extra});
export const DEMO_CARDS = [
  record('Acorn & Co.','Germany','demo-clients','client',
    'Squirrel-run woodland pantry. Ordered 120 kg of hazelnuts and 60 kg of walnuts for autumn deliveries. Requests dry, shell-on nuts in reusable 5 kg sacks. A 20 kg apple trial is under evaluation; the next quotation should price nuts and fruit separately.',
    [contact('demo-hazel','Hazel Squirrel','Purchasing manager','hazel@acorn.example','main'),contact('demo-pip','Pip Squirrel','Storekeeper','pip@acorn.example'),contact('demo-willow','Willow Squirrel','','willow@acorn.example','useful')],
    '2026-10-03',{status:'massProduction',priority:3,starred:true,dueDate:'2026-10-08',tagIds:['demo-nuts','demo-fruit','demo-winter'],flags:{inQuote:{active:true,comment:'Quote the next 120 kg hazelnut delivery'}},checklist:[{text:'Confirm reusable 5 kg sacks',done:true},{text:'Send separate nut and apple prices',done:false},{text:'Confirm Thursday delivery',done:false}],
      activity:[{text:'Hazel confirmed the autumn nut order: 120 kg hazelnuts and 60 kg walnuts. Quoted reusable sacks; Thursday delivery is preferred.',createdAt:'2026-10-03T10:30:00.000Z',contactIds:['demo-hazel']},{text:'Pip received the apple samples. Keep the fruit trial separate from the confirmed nut order.',createdAt:'2026-09-24T09:15:00.000Z',contactIds:['demo-pip','demo-hazel']}]}),
  record('Bramble Bear Bakery','Canada','demo-clients','client','Bear bakery buying apples, pears and walnuts for fruit pies. The first order arrived; weekly deliveries begin after packaging approval.',[contact('demo-bruno','Bruno Bear','Head baker','bruno@bramble.example','main')],'2026-10-02',{status:'rampUp',priority:2,tagIds:['demo-fruit','demo-nuts'],flags:{logisticsIssue:{active:true,comment:'Confirm insulated crates for pears'}}}),
  record('Clover Rabbit Kitchen','United Kingdom','demo-opportunities','opportunity','Rabbit kitchen evaluating carrots, cabbage and leafy greens for 40 lunch boxes each weekday. Samples accepted; weekly volumes and price remain to be agreed.',[contact('demo-clover','Clover Rabbit','Kitchen buyer','clover@rabbit-kitchen.example')],'2026-10-01',{status:'evaluation',priority:2,tagIds:['demo-vegetables','demo-samples']}),
  record('Mossy Hedgehog Market','France','demo-prospects','unspecified','Hedgehog market interested in mixed berries and small apples. Requested availability for the winter season; no order yet.',[contact('demo-hedge','Hattie Hedgehog','','hattie@hedgehog-market.example')],'2026-09-29',{tagIds:['demo-fruit','demo-winter']}),
  record('Silver Fox Fruit Shop','Netherlands','demo-opportunities','opportunity','Fox fruit shop testing pears and apples in returnable crates. Requires consistent ripeness and a price for a 50 kg trial before committing.',[contact('demo-fenn','Fenn Fox','Owner','fenn@fox-fruit.example','decisions')],'2026-09-28',{status:'evaluation',priority:1,tagIds:['demo-fruit','demo-samples']}),
  record('Willow Beaver Catering','Sweden','demo-clients','client','Beaver catering cooperative with a confirmed monthly carrot and cabbage order. Expanding the programme to seasonal fruit after the first deliveries.',[contact('demo-brook','Brook Beaver','Operations manager','brook@beaver-catering.example')],'2026-09-25',{status:'massProduction',tagIds:['demo-vegetables','demo-fruit']}),
  record('Oak Owl Orchard','Italy','demo-partners','partner','Owl orchard packs apples and pears for joint woodland tastings. Agreed to share harvest availability and reusable crates; this is a supply partnership.',[contact('demo-olive','Olive Owl','Orchard manager','olive@owl-orchard.example')],'2026-09-22',{status:'rampUp',starred:true,tagIds:['demo-fruit']}),
  record('Pine Marten Produce','Finland','demo-agents','distributor','Marten agent sources nuts and vegetables for three woodland shops. Requests consolidated invoices, mixed pallets and separate shop labels.',[contact('demo-milo','Milo Marten','Agent','milo@marten-produce.example')],'2026-09-18',{status:'evaluation',priority:2,tagIds:['demo-nuts','demo-vegetables']}),
  record('Deer Meadow Grocers','Poland','demo-prospects','unspecified','Deer grocery considering weekly leafy greens and apples. Asked for a sample box; delivery frequency has not been confirmed.',[contact('demo-dawn','Dawn Deer','Buyer','dawn@deer-grocers.example')],'2026-09-10',{tagIds:['demo-vegetables','demo-fruit','demo-samples']}),
  record('Badger Burrow Stores','Denmark','demo-leads','lead','Badger store newly identified as a possible buyer of walnuts and root vegetables. Product interest is preliminary; the buyer still needs to confirm volumes.',[contact('demo-basil','Basil Badger','','basil@badger-stores.example')],'2025-11-18',{tagIds:['demo-nuts','demo-vegetables']}),
  record('Robin Berry Delivery','Norway','demo-agents','distributor','Robin delivery service buys fruit on behalf of small forest cafes. Interested in a shared weekly route and labelled berry baskets.',[contact('demo-rowan','Rowan Robin','Route coordinator','rowan@robin-delivery.example')],'2024-06-14',{tagIds:['demo-fruit']}),
  record('Dormouse Winter Pantry','Austria','demo-leads','lead','Dormouse pantry asked about a nut assortment several seasons ago. Confirm the current buyer and storage capacity before offering a new winter batch.',[contact('demo-dot','Dot Dormouse','','dot@dormouse-pantry.example')],'2023-10-04',{status:'legacy',tagIds:['demo-nuts','demo-winter']}),
];
