alter table public.categories add column sort_order integer not null default 0 check(sort_order between 0 and 100000);
create function public.check_category_hierarchy() returns trigger language plpgsql set search_path=public as $$
declare ancestor text:=new.parent_id;seen text[]:=array[new.id];level integer:=0;span integer;begin
 perform pg_advisory_xact_lock(hashtext('edge-category-hierarchy'));
 while ancestor is not null loop
  if ancestor=any(seen) then raise exception 'Category parents cannot form a circle';end if;
  seen:=array_append(seen,ancestor);level:=level+1;
  if level>2 then raise exception 'Use at most three category levels';end if;
  select parent_id into ancestor from categories where id=ancestor;
  if not found then raise exception 'Parent category does not exist';end if;
 end loop;
 with recursive descendants as (
  select id,1 depth,array[new.id,id] path from categories where parent_id=new.id
  union all select c.id,d.depth+1,d.path||c.id from categories c join descendants d on c.parent_id=d.id where d.depth<3 and not c.id=any(d.path)
 ) select coalesce(max(depth),0) into span from descendants;
 if level+span>2 then raise exception 'Moving this category would exceed three levels';end if;
 return new;
end $$;
create trigger categories_hierarchy before insert or update of parent_id on public.categories for each row execute function public.check_category_hierarchy();
